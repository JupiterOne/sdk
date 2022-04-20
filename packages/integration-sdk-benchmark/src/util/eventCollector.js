function createEventCollector() {
  return {
    events: [],
    addEvent: function (event) {
      this.events.push(event);
    },
    publishEvents: function () {
      this.events.sort((a, b) => {
        return a.target.name > b.target.name;
      });

      for (const event of this.events) {
        console.log(
          event.target.name,
          '\t',
          event.target.hz.toFixed(3),
          'ops/sec',
        );
      }
    },
  };
}

module.exports = {
  createEventCollector,
};
