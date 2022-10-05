export interface Metric {
  name: string;
  value: number;

  /*
   * The unit that the metric value is associated with
   */
  unit?: 'Milliseconds' | 'Bytes';

  /**
   * Additional dimensions to add to a metric
   */
  dimensions?: Record<string, string>;

  /**
   * The time that the metric was collected.
   */
  timestamp: number;
}
