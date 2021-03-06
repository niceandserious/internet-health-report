/* global Waypoint */
import * as constants from '../constants';
import $ from 'jquery';
import * as d3 from 'd3';
import '../../plugins/noframework.waypoints';
window.$ = $;

class Bar {
  constructor(el, dataUrl) {
    this.el = el;
    this.dataUrl = dataUrl;
    this.margin = {top: 20, right: 20, bottom: 70, left: 40};
    this.classes = [`bar-horizontal__svg`, `bar-horizontal__data`, `x-axis`, `y-axis`];
    this.svg = d3.select(this.el)
      .append(`svg`)
        .attr(`class`, this.classes[0]);
    this.svgData = this.svg.append(`g`)
      .attr(`transform`, `translate(${this.margin.left},${this.margin.top})`);
  }

  setSizes(transition = false) {
    this.width = $(this.el).width();
    this.height = constants.getWindowWidth() < constants.breakpointM ? 400 : Math.ceil(this.width * 0.52);
    this.innerWidth = this.width - this.margin.left - this.margin.right;
    this.innerHeight = this.height - this.margin.top - this.margin.bottom;

    this.x = d3.scaleBand()
      .rangeRound([0, this.innerWidth])
      .padding(0.2);

    this.y = d3.scaleLinear()
      .rangeRound([this.innerHeight, 0]);

    this.x.domain(this.data.map(d => d[this.dataKeys[0]]));
    this.y.domain([0, d3.max(this.data, d => d[this.dataKeys[1]])]);

    this.svg
      .attr(`width`, this.width)
      .attr(`height`, this.height);

    this.svg.selectAll(`.${this.classes[1]}`)
      .attr(`x`, d => this.x(d[this.dataKeys[0]]))
      .attr(`y`, this.innerHeight)
      .attr(`width`, this.x.bandwidth());

    this.setAxes();

    if (transition) {
      this.animateChart();
    } else {
      this.svg.selectAll(`.${this.classes[1]}`)
        .attr(`y`, d => this.y(d[this.dataKeys[1]]))
        .attr(`height`, d => this.innerHeight - this.y(d[this.dataKeys[1]]));
    }
  }

  animateChart() {
    $(this.el).addClass(`is-active`);

    this.svg.selectAll(`.${this.classes[1]}`)
      .transition()
      .duration(constants.chartFadeIn + 500)
      .delay((d, i) => i * 100)
      .attr(`y`, d => this.y(d[this.dataKeys[1]]))
      .attr(`height`, d => this.innerHeight - this.y(d[this.dataKeys[1]]));
  }

  setAxes() {
    this.svg.select(`.${this.classes[2]}`)
      .attr(`transform`, `translate(0,${this.innerHeight})`)
      .call(d3.axisBottom(this.x))
      .selectAll(`text`)
        .attr(`x`, -6)
        .attr(`y`, 6)
        .attr(`text-anchor`, `end`)
        .attr(`transform`, `rotate(-45)`);

    this.svg.select(`.${this.classes[3]}`)
      .call(d3.axisLeft(this.y)
        .tickFormat(d3.formatPrefix(`.0`, 1e6)));
  }

  render() {
    d3.tsv(this.dataUrl, (error, data) => {
      if (error) {
        throw error;
      }

      this.data = data;
      this.dataKeys = constants.getDataKeys(this.data);
      this.data.forEach(this.type.bind(this));

      this.svgData.selectAll(`.${this.classes[1]}`)
        .data(this.data)
        .enter().append(`rect`)
        .attr(`class`, this.classes[1]);

      // append x-axis
      this.svgData.append(`g`)
        .attr(`class`, this.classes[2]);

      // append y-axis
      this.svgData.append(`g`)
        .attr(`class`, this.classes[3]);

      const waypoint = new Waypoint({
        element: document.getElementById(this.el.substr(1)),
        handler: () => {
          this.setSizes(true);
          waypoint.destroy();
        },
        offset: `50%`,
      });
    });

    $(window).on(`resize`, this.resize.bind(this));
  }

  resize() {
    this.setSizes();
  }

  type(d) {
    d[this.dataKeys[1]] = parseInt(d[this.dataKeys[1]], 10);
    d[this.dataKeys[1]] = +d[this.dataKeys[1]];
    return d;
  }
}

const loadBarCharts = () => {
  const $bar = $(`.js-bar`);

  $bar.each((index) => {
    const $this = $bar.eq(index);
    const id = $this.attr(`id`);
    const url = $this.data(`url`);

    new Bar(`#${id}`, url).render();
  });
};

export { loadBarCharts };
