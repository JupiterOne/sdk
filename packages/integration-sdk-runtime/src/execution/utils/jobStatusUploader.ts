import {
  IntegrationStepResultMap,
  sha256,
} from '@jupiterone/integration-sdk-core';

export type JobStatusUploadIntervals = {
  intervalMs: number;
  count?: number;
}[];

const DEFAULT_JOB_STATUS_UPLOAD_INTERVALS: JobStatusUploadIntervals = [
  { intervalMs: 60 * 1_000, count: 10 }, // 1 minute
  { intervalMs: 300 * 1_000, count: 10 }, // 5 minutes
  { intervalMs: 600 * 1_000 }, // 10 minutes
];

export class JobStatusUploader {
  private readonly jobStatus: IntegrationStepResultMap;
  private readonly intervals: JobStatusUploadIntervals;
  private readonly jobStatusUploadFn: (jobStatus: any) => Promise<void>;

  private nextUploadTimeout: NodeJS.Timeout | null = null;

  private uploadWithNoChanges;
  private lastUploadHash: string;

  constructor(
    config: {
      jobStatus: IntegrationStepResultMap;
      intervals?: JobStatusUploadIntervals;
      uploadWithNoChanges?: boolean;
    },
    jobStatusUploadFn: (jobStatus: any) => Promise<void>,
  ) {
    const { jobStatus, intervals } = config;

    if (intervals && !intervals.length) {
      throw new Error('intervals must have a length greater than 0');
    }

    this.jobStatus = jobStatus;
    this.jobStatusUploadFn = jobStatusUploadFn;
    // Deep copy the intervals to avoid mutating original array/objects.
    this.intervals = JSON.parse(
      JSON.stringify(intervals ?? DEFAULT_JOB_STATUS_UPLOAD_INTERVALS),
    );
    this.uploadWithNoChanges = !!config.uploadWithNoChanges;
  }

  public start() {
    this.uploadJobStatus();
  }

  /**
   * Stops the job status uploader and uploads the current job status.
   *
   * See {@link JobStatusUploader#abort} to stop the job status uploader without uploading the current job status.
   */
  public async stop() {
    if (this.nextUploadTimeout) {
      clearTimeout(this.nextUploadTimeout);
      this.nextUploadTimeout = null;
    }
    await this.jobStatusUploadFn(this.jobStatus);
  }

  public abort() {
    if (this.nextUploadTimeout) {
      clearTimeout(this.nextUploadTimeout);
      this.nextUploadTimeout = null;
    }
  }

  private getNextTimeout() {
    if (this.intervals[0].count === undefined) {
      return this.intervals[0].intervalMs;
    }

    if (this.intervals[0].count === 0) {
      this.intervals.shift();
      return this.getNextTimeout();
    }

    this.intervals[0].count--;
    return this.intervals[0].intervalMs;
  }

  private uploadJobStatus() {
    this.nextUploadTimeout = setTimeout(async () => {
      if (this.uploadWithNoChanges) {
        await this.jobStatusUploadFn(this.jobStatus);
      } else {
        const hash = sha256(this.jobStatus);
        if (hash !== this.lastUploadHash) {
          this.lastUploadHash = hash;
          await this.jobStatusUploadFn(this.jobStatus);
        }
      }

      this.uploadJobStatus();
    }, this.getNextTimeout());
  }
}
