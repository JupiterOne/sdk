export type GraphObjectTypeSummary = {
  total: number;
};

export class IntegrationExecutionSummarizer {
  readonly graphObjectTypeSummary = new Map<string, GraphObjectTypeSummary>();

  incrGraphObjectType(_type: string, count: number) {
    const existingSummary = this.graphObjectTypeSummary.get(_type);

    if (existingSummary) {
      existingSummary.total += count;
    } else {
      this.graphObjectTypeSummary.set(_type, {
        total: count,
      });
    }
  }
}
