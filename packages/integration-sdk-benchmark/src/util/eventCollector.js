class EventCollector {
  constructor() {
    this.events = [];
  }

  /**
   * addEvent adds an event to the EventCollector
   *
   * @param event - The benchmark.js event to be recorded
   */
  addEvent(event) {
    this.events.push(event);
  }

  /**
   * publishEvents formats all the recorded events and output the results into
   * a human readable format
   */
  publishEvents() {
    this.events.sort((event1, event2) => {
      return event1.target.name > event2.target.name;
    });

    /* eslint-disable no-console */
    for (const event of this.events) {
      console.log(
        event.target.name,
        '\t',
        event.target.hz.toFixed(3),
        'ops/sec',
      );
    }
  }
}

function createEventCollector() {
  return new EventCollector();
}

module.exports = {
  createEventCollector,
};
