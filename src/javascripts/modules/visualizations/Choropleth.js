/* global Waypoint */
import * as constants from '../constants';
import $ from 'jquery';
import * as d3 from 'd3';
import '../../plugins/noframework.waypoints';
import { TweenLite } from 'gsap';
import * as topojson from 'topojson';
window.$ = $;

class Choropleth {
  constructor(el, dataUrl, dataUnits = ``, isDataOrdinal = false) {
    this.el = el;
    this.aspectRatio = 0.6663;
    this.width = $(this.el).width();
    this.height = Math.ceil(this.aspectRatio * this.width);
    this.classes = [`choropleth__svg`, `choropleth__item`, `choropleth__tooltip`, `choropleth__legend`];
    this.mapWidth = this.width;
    this.shapeUrl = `/data/world-shape-data.json`;
    this.dataUrl = dataUrl;
    this.dataUnits = dataUnits;
    this.isDataOrdinal = isDataOrdinal;
  }

  render() {
    this.svg = d3.select(this.el).append(`svg`)
      .attr(`width`, `100%`)
      .attr(`height`, this.height)
      .attr(`class`, this.classes[0])
      .append(`g`);

    this.loadData();
    $(window).on(`resize`, this.resizeChoropleth.bind(this));
  }

  resizeChoropleth() {
    window.requestAnimationFrame(() => {
      const chart = $(this.el).find(`g`);

      this.width = $(this.el).width();
      this.height = Math.ceil(this.aspectRatio * this.width);

      TweenLite.set(chart, { scale: this.width / this.mapWidth });
      d3.select(`.${this.classes[0]}`).attr(`height`, this.height);
    });
  }

  loadData() {
    d3.queue()
      .defer(d3.json, this.shapeUrl)
      .defer(d3.csv, this.dataUrl)
      .await(this.drawMap.bind(this));
  }

  drawMap(error, shapeData, vizData) {
    if (error) {
      return console.error(error);
    }

    this.shapeData = shapeData;
    this.vizData = vizData;
    this.dataKeys = constants.getDataKeys(this.vizData);
    this.setOrdinalScale();
    this.draWTooltip();

    const countries = topojson.feature(this.shapeData, this.shapeData.objects[`countries`]);
    // we should be able to change this to use the Robinson projection
    // Mercators good for ships, and navigation, but it's Robinson is arguably
    // more culturally senstive.
    const projection = d3.geoMercator()
      .fitSize([this.width, this.height], countries);
    const path = d3.geoPath()
      .projection(projection);

    countries.features.forEach((country) => {
      let countrySet = false;

      this.vizData.forEach((data) => {
        if (country.id === data[this.dataKeys[0]]) {
          country[this.dataKeys[1]] = this.isDataOrdinal ? data[this.dataKeys[1]] : Number(data[this.dataKeys[1]]);
          countrySet = true;
        }
      });

      if (!countrySet) {
        if (this.isDataOrdinal) {
          country[this.dataKeys[1]] = `Unknown`;
        }
      }
    });

    this.svg.selectAll(`.${this.classes[1]}`)
      .data(countries.features)
      .enter().append(`path`)
      .attr(`class`, this.classes[1])
      .attr(`id`, d => d.id, true)
      .attr(`d`, path);

    if (!this.isDataOrdinal) {
      this.svg.selectAll(`.${this.classes[1]}`)
        .on(`mouseover`, d => {
          this.tooltip
            .html(() => {
              if (d[this.dataKeys[1]]) {
                return `${d.id}: ${d[this.dataKeys[1]]}${this.dataUnits}`;
              } else {
                return `${d.id}: n/a`;
              }
            })
            .classed(`is-active`, true);
        })
        .on(`mousemove`, () => {
          this.tooltip
            .style(`top`, `${d3.event.pageY - $(this.el).offset().top}px`)
            .style(`left`, `${d3.event.pageX - $(this.el).offset().left}px`);
        })
        .on(`mouseout`, () => {
          this.tooltip
            .classed(`is-active`, false);
        });

      this.setDataRange();
      this.setData();
      this.drawLegend();
    } else {
      this.setDataOrdinal();
      this.drawOrdinalLegend();
    }

    const waypoint = new Waypoint({
      element: document.getElementById(this.el.substr(1)),
      handler: () => {
        $(this.el).addClass(`is-active`);
        waypoint.destroy();
      },
      offset: `40%`,
    });
  }

  setOrdinalScale() {
    this.scaleKeys = [];

    this.vizData.forEach(el => {
      const scaleKey = el[this.dataKeys[1]];

      if (this.scaleKeys.indexOf(scaleKey) === -1) {
        this.scaleKeys.push(scaleKey);
      }
    });

    this.colorScale = d3.scaleOrdinal()
      .domain([this.scaleKeys])
      .range(constants.colorRange);
  }

  draWTooltip() {
    this.tooltip = d3.select(this.el)
      .append(`div`)
      .attr(`class`, this.classes[2]);
  }

  drawLegend() {
    const min = this.dataRange[0];
    const max = this.dataRange[1];
    const legendString = `<div class="legend legend--scale">` +
      `<p class="legend__value">${Math.floor(min / 1)}%</p>` +
      `<div class="legend__scale"></div>` +
      `<p class="legend__value">${Math.floor(max / 1)}%</p>` +
    `</div>`;

    $(this.el).append(legendString);
  }

  drawOrdinalLegend() {
    const legendId = $(this.el).next(`.legend`).attr(`id`);
    const ordinalLegend = d3.select(`#${legendId}`).selectAll(`li`)
      .data(this.scaleKeys)
      .enter().append(`li`)
      .attr(`class`, `legend__item`);

    ordinalLegend.append(`span`)
      .attr(`class`, `legend__key`)
      .style(`background-color`, d => this.colorScale(d));

    ordinalLegend.append(`span`)
      .attr(`class`, `legend__name`)
      .text((d, i) => this.scaleKeys[i]);
  }

  setData() {
    d3.selectAll(`.${this.classes[1]}`)
      .attr(`fill-opacity`, d => {
        return this.getOpacity(d[this.dataKeys[1]]);
      });
  }

  setDataOrdinal() {
    d3.selectAll(`.${this.classes[1]}`)
      .style(`fill`, d => {
        return this.colorScale(d[this.dataKeys[1]]);
      });
  }

  setDataRange() {
    const dataArray = this.vizData.map((object) => object[this.dataKeys[1]]);
    const min = Math.min(...dataArray);
    const max = Math.max(...dataArray);

    this.dataRange = [min, max];
  }

  getOpacity(value) {
    const opacity = d3.scaleLinear()
      .domain([this.dataRange[0], this.dataRange[1]])
      .range([0.1, 1]);

    return opacity(value);
  }
}

const loadChoropleths = () => {
  const $choropleth = $(`.js-choropleth`);

  $choropleth.each((index) => {
    const $this = $choropleth.eq(index);
    const id = $this.attr(`id`);
    const url = $this.data(`url`);
    const units = $this.data(`units`);
    const ordinal = $this.data(`ordinal`);

    new Choropleth(`#${id}`, url, units, ordinal).render();
  });
};

export { loadChoropleths };
