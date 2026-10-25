import fs from 'fs';
import path from 'path';
import { ChildProcess, spawn } from 'child_process';
import axios, { AxiosError } from 'axios';
import { env } from '../config/env';
import { AppError } from '../utils/apiResponse';

export interface NormalizedTrack {
  providerId: string;
  title: string;
  artists: { id?: string | null; name: string }[];
  artistName: string;
  album?: { id?: string | null; name: string } | null;
  durationSeconds?: number | null;
  durationFormatted: string;
  thumbnailUrl?: string | null;
  isExplicit: boolean;
  playbackType: 'YOUTUBE_EMBED';
  embedUrl: string;
  externalUrl: string;
  viewCount?: string;
}

export interface SearchResponseData {
  query: string;
  filter: string;
  tracks: NormalizedTrack[];
  albums: {
    providerId: string;
    title: string;
    artistName: string;
    year?: string | null;
    thumbnailUrl?: string | null;
    externalUrl: string;
  }[];
  artists: {
    providerId: string;
    name: string;
    thumbnailUrl?: string | null;
    externalUrl: string;
  }[];
}

class MusicProviderAdapter {
  private readonly timeoutMs = 8500;
  private pythonProcess: ChildProcess | null = null;
  private startingPromise: Promise<boolean> | null = null;

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      Accept: 'application/json',
    };
    if (env.INTERNAL_SERVICE_TOKEN) {
      headers['X-Internal-Token'] = env.INTERNAL_SERVICE_TOKEN;
    }
    return headers;
  }

  public async checkHealth(): Promise<{ reachable: boolean; engine?: string; url: string }> {
    try {
      const response = await axios.get(`${env.MUSIC_SERVICE_URL}/health`, {
        headers: this.getHeaders(),
        timeout: 3000,
      });
      if (response.data?.success) {
        return {
          reachable: true,
          engine: response.data.data?.engine || 'ytmusicapi',
          url: env.MUSIC_SERVICE_URL,
        };
      }
      return { reachable: false, url: env.MUSIC_SERVICE_URL };
    } catch {
      return { reachable: false, url: env.MUSIC_SERVICE_URL };
    }
  }

  /**
   * Ensures the local Python music discovery microservice is running and reachable.
   * Safe to call at startup or on-demand if a local connection is refused.
   */
  public async ensureServiceRunning(): Promise<boolean> {
    const initialHealth = await this.checkHealth();
    if (initialHealth.reachable) {
      return true;
    }

    if (env.NODE_ENV === 'test') {
      return false;
    }

    if (this.startingPromise) {
      return this.startingPromise;
    }

    this.startingPromise = (async () => {
      try {
        const candidates = [
          path.resolve(process.cwd(), 'music-service', 'run.py'),
          path.resolve(process.cwd(), '..', 'music-service', 'run.py'),
        ];
        const scriptPath = candidates.find((p) => fs.existsSync(p));
        if (!scriptPath) {
          return false;
        }

        let targetPort = '5001';
        try {
          const parsedUrl = new URL(env.MUSIC_SERVICE_URL);
          if (parsedUrl.port) {
            targetPort = parsedUrl.port;
          }
        } catch {
          // Use default 5001
        }

        const pythonBin = process.platform === 'win32' ? 'python' : 'python3';
        this.pythonProcess = spawn(pythonBin, [scriptPath], {
          env: {
            ...process.env,
            PORT: targetPort,
            MUSIC_SERVICE_PORT: targetPort,
            INTERNAL_SERVICE_TOKEN: env.INTERNAL_SERVICE_TOKEN,
          },
          stdio: 'ignore',
        });

        this.pythonProcess.on('error', () => {
          this.pythonProcess = null;
        });
        this.pythonProcess.on('exit', () => {
          this.pythonProcess = null;
        });

        for (let i = 0; i < 12; i++) {
          await new Promise((resolve) => setTimeout(resolve, 250));
          const check = await this.checkHealth();
          if (check.reachable) {
            return true;
          }
        }
        return false;
      } finally {
        this.startingPromise = null;
      }
    })();

    return this.startingPromise;
  }

  public stopManagedService(): void {
    if (this.pythonProcess) {
      this.pythonProcess.kill();
      this.pythonProcess = null;
    }
  }

  public async search(query: string, filter = 'songs', limit = 15): Promise<SearchResponseData> {
    try {
      const response = await this.requestWithAutoRecovery(() =>
        axios.get(`${env.MUSIC_SERVICE_URL}/search`, {
          params: { q: query, filter, limit },
          headers: this.getHeaders(),
          timeout: this.timeoutMs,
        })
      );

      if (!response.data?.success) {
        throw new AppError(
          502,
          response.data?.error?.code || 'PROVIDER_ERROR',
          response.data?.error?.message || 'Music provider returned an error.'
        );
      }

      return response.data.data as SearchResponseData;
    } catch (err) {
      if (err instanceof AppError) throw err;
      this.handleAxiosError(err);
    }
  }

  public async getTrack(providerId: string): Promise<NormalizedTrack> {
    try {
      const response = await this.requestWithAutoRecovery(() =>
        axios.get(`${env.MUSIC_SERVICE_URL}/tracks/${encodeURIComponent(providerId)}`, {
          headers: this.getHeaders(),
          timeout: this.timeoutMs,
        })
      );

      if (!response.data?.success || !response.data?.data?.track) {
        throw new AppError(
          404,
          'TRACK_NOT_FOUND',
          'Requested track was not found by the provider.'
        );
      }

      return response.data.data.track as NormalizedTrack;
    } catch (err) {
      if (err instanceof AppError) throw err;
      this.handleAxiosError(err);
    }
  }

  private async requestWithAutoRecovery<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      if (
        axios.isAxiosError(err) &&
        !err.response &&
        err.code !== 'ECONNABORTED' &&
        env.NODE_ENV !== 'test'
      ) {
        const recovered = await this.ensureServiceRunning();
        if (recovered) {
          return await fn();
        }
      }
      throw err;
    }
  }

  private handleAxiosError(err: unknown): never {
    if (axios.isAxiosError(err)) {
      const axiosErr = err as AxiosError<{ error?: { code?: string; message?: string } }>;
      if (axiosErr.code === 'ECONNABORTED' || axiosErr.response?.status === 504) {
        throw new AppError(
          504,
          'MUSIC_PROVIDER_TIMEOUT',
          'The music discovery service timed out while querying YouTube Music. Please try again.'
        );
      }
      if (axiosErr.response) {
        const status = axiosErr.response.status;
        const apiError = axiosErr.response.data?.error;
        throw new AppError(
          status >= 400 && status < 600 ? status : 502,
          apiError?.code || 'MUSIC_PROVIDER_ERROR',
          apiError?.message || 'Music provider rejected the request.'
        );
      }
      throw new AppError(
        503,
        'MUSIC_SERVICE_UNREACHABLE',
        `Music discovery service at ${env.MUSIC_SERVICE_URL} is currently unreachable. Ensure the Python music-service is running.`
      );
    }
    throw new AppError(
      502,
      'MUSIC_PROVIDER_ERROR',
      'Unexpected error communicating with music service.'
    );
  }
}

export const musicProviderAdapter = new MusicProviderAdapter();
