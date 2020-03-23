import React, {memo} from "react";
import ReactDOM from "react-dom";
import { Map, TileLayer, Marker, Tooltip,
    CircleMarker, LayerGroup } from "react-leaflet";

import * as Testing from "./TestingRates";
import * as Population from "./Population";

import { CSSTransitionGroup } from 'react-transition-group'
import {Multiselect} from "multiselect-react-dropdown";


import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faWindowMinimize,
  faUsers,
  faProcedures,
  faHeartbeat,
  faHeartBroken,
  faBiohazard,
  faPlayCircle,
  faStopCircle,
  faPauseCircle,
  faQuestionCircle, faBug, faBalanceScale
} from '@fortawesome/free-solid-svg-icons';

import Papa from "papaparse";
import Form from 'react-bootstrap/Form';
import Badge from 'react-bootstrap/Badge';
import ReactBootstrapSlider from "react-bootstrap-slider";

const geoUrl =
  "https://raw.githubusercontent.com/zcreativelabs/react-simple-maps/master/topojson-maps/world-10m.json";

const ONE_M = 1000000;

const rounded = num => {
  if (num > 1000000000) {
    return Math.round(num / 100000000) / 10 + "Bn";
  } else if (num > 1000000) {
    return Math.round(num / 100000) / 10 + "M";
  } else if (num > 1000) {
    return Math.round(num / 100) / 10 + "K";
  } else {
    return Math.round(num);
  }
};

class MapChart extends Map {
  constructor(props) {
    super(props);
    this.state = {
      setTotConf: props.setTotConf,
      setTotRec: props.setTotRec,
      setTotDead: props.setTotDead,
      chart: "pie",
      factor: 50,
      width: 2,
      logmode: true,
      momentum: "none",
      ppmmode: false,
      minimized: false,
      testmode: false,
      dayOffset: 0,
      playmode: false,
      mapstyle: "https://cartodb-basemaps-{s}.global.ssl.fastly.net/light_all/{z}/{x}/{y}.png",
      selectedData: ["projected", "confirmed", "recovered", "deceased"],

      maxSize: 67021,

      // leaflet map
      lat: 0,
      lng: 0,
      zoom: 2
    };

    this.map = null;

    this.deathsByRowId = {};
    this.recoveredAbsByRowId = {};
    this.deathsAbsByRowId = {};

    this.confirmed = [];
    this.recovered = [];
    this.deaths = [];
    this.projected = []; /* this will be local_confirmed_rate * avg_test_rate / local_test_rate */

    this.totConf = 0;
    this.totRec = 0;
    this.totDead = 0;

  }

  componentDidMount() {
    this.reload();
  }

  componentDidUpdate (prevProps) {
      this.updateLeafletElement(prevProps, this.props);
      const layers = this.map.leafletElement._layers;

      // bring to front one by one
      Object.values(layers).map((layer) => {
        if(layer.options.className ==="projected") {
          layer.bringToFront();
        }
      });

      Object.values(layers).map((layer) => {
        if(layer.options.className ==="confirmed") {
          layer.bringToFront();
        }
      });

      Object.values(layers).map((layer) => {
        if(layer.options.className ==="recovered") {
          layer.bringToFront();
        }
      });

      Object.values(layers).map((layer) => {
        if(layer.options.className ==="deceased") {
          layer.bringToFront();
        }
      });

    /*
    Object.values(layers)
      .filter((layer) => {
        return typeof layer.options.priority !== "undefined";
      })
      .sort((layerA, layerB) => {
        return layerA.options.priority - layerB.options.priority;
      })
      .forEach((layer) => {
        layer.bringToFront();
      });*/
  }

  get_sums(NAME, extension) {
	  let that = this;
			  let population_sum = 0;
			  let confirmed_sum = 0;
			  let projected_sum = 0;
			  let active_sum = 0;
			  let recovered_sum = 0;
			  let deaths_sum = 0;
		          for(let c of that.confirmed) {
                    if (c.name.endsWith(extension)) {
                      if (!isNaN(Population.ABSOLUTE[c.name])) {
                        population_sum += Population.ABSOLUTE[c.name];
                        confirmed_sum += that.confirmed[c.rowId].val;
                        projected_sum += that.projected[c.rowId].val;
                        active_sum += that.confirmed[c.rowId].val - that.recoveredAbsByRowId[c.rowId] - that.deathsAbsByRowId[c.rowId];
                        recovered_sum += that.recovered[c.rowId].val;
                        deaths_sum += that.deaths[c.rowId].val;
                      }
                    }
                  }
	  return [population_sum, confirmed_sum, projected_sum, active_sum, recovered_sum, deaths_sum];
  }

  reload = () => {
    let that = this;
    that.totConf = 0;
    that.totRec = 0;
    that.totDead = 0;
    that.deathsByRowId = {};
    that.recoveredAbsByRowId = {};
    that.deathsAbsByRowId = {};

    Papa.parse("https://raw.githubusercontent.com/CSSEGISandData/COVID-19/master/csse_covid_19_data/csse_covid_19_time_series/time_series_19-covid-Confirmed.csv", {
      download: true,
      complete: function(results) {
        // confirmed
        that.confirmed = [];
        let skipRow = true;
        let minSize = 0;
        let rowId = 0;
        let avgTested = 0;
        let avgPopulation = 0;
        let countTested = 0;
        let countPopulation = 0;
        for(let data of results.data) {
          if(skipRow) {
            skipRow = false;
            continue;
          }
          let size = "";
          let sizeMin1 = "";
          let sizeMin3 = "";
          let sizeMin7 = "";
          let i = data.length - 1 + that.state.dayOffset;
          while(size==="" && i > 0) {
            size = data[i];
            sizeMin1 = data[i - 1];
            sizeMin3 = data[i - 3];
            sizeMin7 = data[i - 7];
            i = i - 1;
          }
          if(size==="") {
            size = 0;
          }
          if(sizeMin1==="") {
            sizeMin1 = 0;
          }
          if(sizeMin3==="") {
            sizeMin3 = 0;
          }
          if(sizeMin7==="") {
            sizeMin7 = 0;
          }
          size = Number(size);
          sizeMin1 = Number(sizeMin1);
          sizeMin3 = Number(sizeMin3);
          sizeMin7 = Number(sizeMin7);
          if(size > that.state.maxSize) {
            that.state.maxSize = size;
          }
          let marker = {
            markerOffset: 0,
            name: (data[0] ? data[0] + ", " + data[1] : data[1]) ? (data[0] ? data[0] + ", " + data[1] : data[1]) : "",
            coordinates: [data[3], data[2]],
            size: size,
            sizeMin1: sizeMin1,
            sizeMin3: sizeMin3,
            sizeMin7: sizeMin7,
            val: size,
            rowId: rowId,
            valMin1: size - sizeMin1,
            valMin3: size - sizeMin3,
            valMin7: size - sizeMin7
          };
          that.totConf += size;
          that.confirmed.push(marker);

          // compute total tested and total population
          if(Testing.RATES[marker.name] && Population.ABSOLUTE[marker.name]) {
            avgTested += Testing.RATES[marker.name];
            avgPopulation += Population.ABSOLUTE[marker.name];
            countTested++;
            countPopulation++;
          }
          rowId++;
        }
        avgTested /= countTested;
        avgPopulation /= countPopulation;
        that.state.setTotConf(that.totConf);
        for(let i = 0; i < that.confirmed.length; i++) {
          that.confirmed[i].size = (that.confirmed[i].size - minSize) / (that.state.maxSize - minSize);
          that.confirmed[i].momentumLast1 = that.confirmed[i].size - (that.confirmed[i].sizeMin1 - minSize) / (that.state.maxSize - minSize);
          that.confirmed[i].momentumLast3 = that.confirmed[i].size - (that.confirmed[i].sizeMin3 - minSize) / (that.state.maxSize - minSize);
          that.confirmed[i].momentumLast7 = that.confirmed[i].size - (that.confirmed[i].sizeMin7 - minSize) / (that.state.maxSize - minSize);
        }

        // projected
        let globalTestRate = avgTested / avgPopulation;
        that.projected = [];
        skipRow = true;
        rowId = 0;
        for(let data of results.data) {
          if(skipRow) {
            skipRow = false;
            continue;
          }
          let size = that.confirmed[rowId].size;
          let val = that.confirmed[rowId].val;
          if(Testing.RATES[that.confirmed[rowId].name] && Population.ABSOLUTE[that.confirmed[rowId].name]) {
            let localTestRate = Testing.RATES[that.confirmed[rowId].name] / Population.ABSOLUTE[that.confirmed[rowId].name];
            let inverseTestFactor = globalTestRate / localTestRate;
            size = size * inverseTestFactor;
            val = val * inverseTestFactor;
          } else {
            size = 0;
          }
          let marker = {
            markerOffset: 0,
            name: that.confirmed[rowId].name,
            coordinates: that.confirmed[rowId].coordinates,
            size: size,
            val: val,
            rowId: that.confirmed[rowId].rowId,
          };
          that.projected.push(marker);
          rowId++;
        }
        that.setState({});
      }
    });

    Papa.parse("https://raw.githubusercontent.com/CSSEGISandData/COVID-19/master/csse_covid_19_data/csse_covid_19_time_series/time_series_19-covid-Recovered.csv", {
      download: true,
      complete: function(results) {
        that.recovered = [];
        let skipRow = true;
        let minSize = 0;
        let rowId = 0;
        for(let data of results.data) {
          if(skipRow) {
            skipRow = false;
            continue;
          }
          let size = "";
          let sizeMin1 = "";
          let sizeMin3 = "";
          let sizeMin7 = "";
          let i = data.length - 1 + that.state.dayOffset;
          while(size==="" && i > 0) {
            size = data[i];
            sizeMin1 = data[i - 1];
            sizeMin3 = data[i - 3];
            sizeMin7 = data[i - 7];
            i = i - 1;
          }
          if(size==="") {
            size = 0;
          }
          if(sizeMin1==="") {
            sizeMin1 = 0;
          }
          if(sizeMin3==="") {
            sizeMin3 = 0;
          }
          if(sizeMin7==="") {
            sizeMin7 = 0;
          }
          size = Number(size);
          sizeMin1 = Number(sizeMin1);
          sizeMin3 = Number(sizeMin3);
          sizeMin7 = Number(sizeMin7);
          if(size > that.state.maxSize) {
            that.state.maxSize = size;
          }
          let marker = {
            markerOffset: 0,
            name: data[0] ? data[0] + ", " + data[1] : data[1],
            coordinates: [data[3], data[2]],
            size: size,
            sizeMin1: sizeMin1,
            sizeMin3: sizeMin3,
            sizeMin7: sizeMin7,
            val: size,
            rowId: rowId,
            valMin1: size - sizeMin1,
            valMin3: size - sizeMin3,
            valMin7: size - sizeMin7
          };
          that.totRec += size;
          that.recovered.push(marker);
          rowId++;
        }
        that.state.setTotRec(that.totRec);
        for(let i = 0; i < that.recovered.length; i++) {
          that.recoveredAbsByRowId[that.recovered[i].rowId] = that.recovered[i].size;
          that.recovered[i].size = (that.recovered[i].size - minSize) / (that.state.maxSize - minSize);
          that.recovered[i].momentumLast1 = that.recovered[i].size - (that.recovered[i].sizeMin1 - minSize) / (that.state.maxSize - minSize);
          that.recovered[i].momentumLast3 = that.recovered[i].size - (that.recovered[i].sizeMin3 - minSize) / (that.state.maxSize - minSize);
          that.recovered[i].momentumLast7 = that.recovered[i].size - (that.recovered[i].sizeMin7 - minSize) / (that.state.maxSize - minSize);
        }
        that.setState({});
      }
    });

    Papa.parse("https://raw.githubusercontent.com/CSSEGISandData/COVID-19/master/csse_covid_19_data/csse_covid_19_time_series/time_series_19-covid-Deaths.csv", {
      download: true,
      complete: function(results) {
        that.deaths = [];
        let skipRow = true;
        let minSize = 0;
        let rowId = 0;
        for(let data of results.data) {
          if(skipRow) {
            skipRow = false;
            continue;
          }
          let size = "";
          let sizeMin1 = "";
          let sizeMin3 = "";
          let sizeMin7 = "";
          let i = data.length - 1 + that.state.dayOffset;
          while(size==="" && i > 0) {
            size = data[i];
            i = i - 1;
          }
          if(size==="") {
            size = 0;
          }
          size = Number(size);
          sizeMin1 = Number(sizeMin1);
          sizeMin3 = Number(sizeMin3);
          sizeMin7 = Number(sizeMin7);
          if(size > that.state.maxSize) {
            that.state.maxSize = size;
          }
          let marker = {
            markerOffset: 0,
            name: data[0] ? data[0] + ", " + data[1] : data[1],
            coordinates: [data[3], data[2]],
            size: size,
            sizeMin1: sizeMin1,
            sizeMin3: sizeMin3,
            sizeMin7: sizeMin7,
            val: size,
            rowId: rowId,
            valMin1: size - sizeMin1,
            valMin3: size - sizeMin3,
            valMin7: size - sizeMin7
          };
          that.totDead += size;
          that.deaths.push(marker);
          rowId++;
        }
        that.state.setTotDead(that.totDead);
        for(let i = 0; i < that.deaths.length; i++) {
          // console.log(deaths[i].size + ", " + minSize + ", " + maxSize);
          that.deathsAbsByRowId[that.deaths[i].rowId] = that.deaths[i].size;
          that.deaths[i].size = (that.deaths[i].size - minSize) / (that.state.maxSize - minSize);
          that.deathsByRowId[that.deaths[i].rowId] = that.deaths[i].size;
          that.deaths[i].momentumLast1 = that.deaths[i].size - (that.deaths[i].sizeMin1 - minSize) / (that.state.maxSize - minSize);
          that.deaths[i].momentumLast3 = that.deaths[i].size - (that.deaths[i].sizeMin3 - minSize) / (that.state.maxSize - minSize);
          that.deaths[i].momentumLast7 = that.deaths[i].size - (that.deaths[i].sizeMin7 - minSize) / (that.state.maxSize - minSize);
        }
        that.setState({});
      }
    });
  };

  onSelect(selectedList, selectedItem) {

}

onRemove(selectedList, removedItem) {

}

  render() {
    let that = this;
    let shownDate = new Date();
    shownDate.setDate(shownDate.getDate() + this.state.dayOffset);

    let dataOptions = [{name: 'Srigar', id: 1},{name: 'Sam', id: 2}];

    return (
      <>
      <div className={"small controls" + (that.state.minimized ? " minimized" : "")}>
        {/*<Form.Check inline className="small hideInJh" checked={that.state.momentum==="none" } label="Live situation" type={"radio"} name={"a"} id={`inline-radio-4`} onClick={() => {that.setState({momentum: "none"});}} />
        <Form.Check inline className="small hideInJh" checked={that.state.momentum==="last1" } label="Momentum last 1 day" type={"radio"} name={"b"} id={`inline-radio-5`} onClick={() => {that.setState({momentum: "last1", chart: "pie"});}} />
        <Form.Check inline className="small hideInJh" checked={that.state.momentum==="last3" } label="Momentum last 3 days" type={"radio"} name={"b"} id={`inline-radio-6`} onClick={() => {that.setState({momentum: "last3", chart: "pie"});}} />
        <Form.Check inline className="small hideInJh" checked={that.state.momentum==="last7" } label="Momentum last 7 days" type={"radio"} name={"b"} id={`inline-radio-7`} onClick={() => {that.setState({momentum: "last7", chart: "pie"});}} />*/}
        <button hidden={that.state.minimized} className={"btn-collapse"} onClick={() => {that.setState({minimized: true})}}>minimize <FontAwesomeIcon icon={faWindowMinimize}/></button>
        <button hidden={!that.state.minimized} className={"btn-collapse"} onClick={() => {that.setState({minimized: false})}}>open</button>
        <div hidden={that.state.minimized}>
          <span className="small text-muted">Mode:</span>
          <Form.Control title={"Live mode: Show live data (updated daily). Change: Show increase/decrease in numbers since last 1, 3 or 7 days.  "} value={that.state.momentum} style={{lineHeight: "12px", padding: "0px", fontSize: "12px", height: "24px"}} size="sm" as="select" onChange={(e) => {that.setState({momentum: e.nativeEvent.target.value, chart: "pie", testmode: false});}}>
            <option value="none">Live</option>
            <option value="last1">Change since last 24 hours</option>
            <option value="last3">Change since last 3 days</option>
            <option value="last7">Change since last 7 days</option>
          </Form.Control>
          {/*<Multiselect
            selectedValues={this.state.selectedData}
            options={["projected", "confirmed", "recovered", "deceased"]}
            isObject={false}
            placeholder={"toggle data"}
            showCheckbox={true}
          />*/}
          <Form.Check inline disabled={that.state.momentum !== "none" || that.state.dayOffset < 0} className="small" checked={that.state.testmode} label={<span title={"Displays a projection of how many confirmed cases there might be if testing rate was as high/low as global average (shown on the map as blue halos)."}>Project global avg. testing rate</span>} type={"checkbox"} name={"a"} id={`inline-checkbox-4`}
            onChange={() => {that.setState({testmode: !that.state.testmode});}} /><br />
          <span className="small text-muted mr-2">Normalization:</span><br />
          <Form.Check inline className="small" checked={that.state.logmode} label={<span title={"Scales the glyphs on the map logarithmically."}>Log</span>} type={"checkbox"} name={"a"} id={`inline-checkbox-2`}
            onChange={() => {that.setState({logmode: !that.state.logmode});}} />
          <Form.Check inline className="small" checked={that.state.ppmmode} label={<span title={"Scales the glyphs on the map according to the number of people in each country/region."}>Population</span>} type={"checkbox"} name={"a"} id={`inline-checkbox-3`}
            onChange={() => {that.setState({ppmmode: !that.state.ppmmode});}} /><br />
          <span className="small text-muted mr-2">Scale:</span><br/>
          <ReactBootstrapSlider title="Scale glyps" value={this.state.factor} change={e => {this.setState({ factor: e.target.value, width: e.target.value / 10 });}} step={1} max={100} min={1}></ReactBootstrapSlider>
          {/*<Form.Check inline title="Represent data as bubbles. Hover bubbles on map to see more details." className="small" checked={that.state.chart==="pie" } label="Bubbles" type={"radio"} name={"a"} id={`inline-radio-1`} onChange={() => {that.setState({chart: "pie"});}}/><br />*/}
          {/*<Form.Check inline title="Represent data as vertical bars. Hover bars on map to see more details." className="small hideInMomentum" checked={that.state.chart==="bar" } label="Bars" type={"radio"} name={"a"} id={`inline-radio-2`} onChange={() => {that.setState({chart: "bar"});}} disabled={that.state.momentum!=="none" ? true : false}/>
          <Form.Check inline title="Represent data as horizontal pill. Hover pill on map to see more details." className="small hideInMomentum" checked={that.state.chart==="pill" } label="Pills" type={"radio"} name={"a"} id={`inline-radio-3`} onChange={() => {that.setState({chart: "pill"});}} disabled={that.state.momentum!=="none" ? true : false}/><br />*/}
          <span className="small text-muted">Map style:</span>
          <Form.Control value={that.state.mapstyle} style={{lineHeight: "12px", padding: "0px", fontSize: "12px", height: "24px"}} size="sm" as="select" onChange={(e) => {that.setState({mapstyle: e.nativeEvent.target.value});}}>
            <option value="https://cartodb-basemaps-{s}.global.ssl.fastly.net/light_all/{z}/{x}/{y}.png">Light</option>
            <option value="https://{s}.tile.osm.org/{z}/{x}/{y}.png">Color</option>
            <option value="https://cartodb-basemaps-{s}.global.ssl.fastly.net/dark_all/{z}/{x}/{y}.png">Dark</option>
          </Form.Control>

          <div className={"credits"}>
            <Badge><a target="_blank" className="text-secondary" rel="noopener noreferrer" href={"https://github.com/daniel-karl/covid19-map/issues"}><FontAwesomeIcon icon={faBug} /> Issues</a></Badge>
            <Badge><a target="_blank" className="text-secondary" rel="noopener noreferrer" href={"https://github.com/daniel-karl/covid19-map#about"}><FontAwesomeIcon icon={faQuestionCircle} /> About</a></Badge>
            <Badge><a target="_blank" className="text-secondary" rel="noopener noreferrer" href={"https://github.com/daniel-karl/covid19-map/blob/master/LICENSE.txt"}><FontAwesomeIcon icon={faBalanceScale} /> MIT</a></Badge>
          </div>
        </div>
      </div>
      <div className="small timeline">
        <button disabled style={{color: "black", opacity: 1, pointerEvents: "none"}} className={"btn btn-sm"}><b>{shownDate.toLocaleDateString()}</b></button>
        <button
            className={this.state.dayOffset < 0 ? "btn btn-sm btn-dark leftTime" : "btn btn-sm btn-outline-dark leftTime"}
            style={{height: "30px", lineHeight: "20px"}}
            onClick={() => {
              this.state.dayOffset = this.state.dayOffset - 1;
              this.state.testmode = false;
              this.reload();
            }}
        >Back</button>

        <button
            className={"btn btn-sm btn-secondary midTime"}
            style={this.state.dayOffset < 0 && !this.state.playmode ? {height: "30px", lineHeight: "20px"} : {display: "none"}}
            onClick={() => {
              this.state.dayOffset = Math.min(0, this.state.dayOffset + 1);
              if(this.state.dayOffset === 0) {
                this.state.playmode = false;
              } else {
                this.state.testmode = false;
              }
              this.reload();
            }}
        >Forward</button>

        <button
            className={this.state.dayOffset < 0 ? "btn btn-sm btn-outline-danger todayTime" : "btn btn-sm btn-danger todayTime"}
            style={{height: "30px", lineHeight: "20px"}}
            onClick={()=>{
              this.state.dayOffset = 0;
              this.reload();
            }}
        >Today</button>

        <button
            className={"btn btn-sm btn-success play"}
            style={{height: "30px", lineHeight: "20px"}}
            onClick={()=>{
              document.getElementsByClassName("todayTime")[0].style.display = "none";
              document.getElementsByClassName("play")[0].style.display = "none";
              document.getElementsByClassName("leftTime")[0].style.display = "none";
              document.getElementsByClassName("midTime")[0].style.display = "none";

              var now = new Date();
              var startDate = new Date("January 22, 2020 00:00:00");
              const oneDay = 24 * 60 * 60 * 1000;
              this.state.dayOffset = - Math.round(Math.abs((now - startDate) / oneDay));
              this.state.testmode = false;
              this.state.playmode = true;
              this.state.playpause = false;
              this.state.lat = 30.5928;
              this.state.lng = 114.3055;
              this.state.zoom = 4;
              let interval = setInterval(() => {
                if(!that.state.playmode) {
                  clearInterval(interval);
                  this.state.dayOffset = 0;
                  this.reload();
                  return;
                }
                if(!this.state.playpause) {
                  this.state.dayOffset++;
                  this.reload();
                }
              }, 500);
            }}
        ><FontAwesomeIcon icon={faPlayCircle}/> Play</button>

        <button
            className={"btn btn-sm pause " + (this.state.playpause ? "btn-success" : "btn-outline-dark")}
            style={this.state.playmode ? {height: "30px", lineHeight: "20px"} : {display : "none"}}
            onClick={()=>{
              this.state.playpause = !this.state.playpause;
              this.reload();
            }}
        >
          {
            !this.state.playpause &&
            [<FontAwesomeIcon icon={faPauseCircle}/>, " Pause"]
          }
          {
            this.state.playpause &&
            [<FontAwesomeIcon icon={faPlayCircle}/>, " Continue"]
          }
        </button>

        <button
            className={"btn btn-sm btn-danger stop"}
            style={this.state.playmode ? {height: "30px", lineHeight: "20px"} : {display : "none"}}
            onClick={()=>{
              document.getElementsByClassName("todayTime")[0].style.display = "inline";
              document.getElementsByClassName("play")[0].style.display = "inline";
              document.getElementsByClassName("leftTime")[0].style.display = "inline";
              document.getElementsByClassName("midTime")[0].style.display = "none";
              this.state.playmode = false;
              this.setState({
                lat: 0,
                lng: 0,
                zoom: 2
              });
            }}
        ><FontAwesomeIcon icon={faStopCircle}/> Stop</button>
      </div>
      {
        that.state.momentum !== "none" &&
        <style dangerouslySetInnerHTML={{__html: `
          .hideInMomentum {
            display: none !important;
          }
          .showInMomentum {
            display: block !important;
          }
        `}} />
      }
        { /*that.reactSimpleMap()*/ }
        { that.leafletMap() }

    </>
    );
  }

  leafletMap = () => {
    const position = [this.state.lat, this.state.lng];
    return (
      <Map ref={(ref) => { this.map = ref}} center={position} zoom={this.state.zoom} zoomControl={false}>
        <TileLayer
          attribution='&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
          // url='https://{s}.tile.osm.org/{z}/{x}/{y}.png'
          // url='https://cartodb-basemaps-{s}.global.ssl.fastly.net/light_all/{z}/{x}/{y}.png'
            url={this.state.mapstyle}
        />

        { /* this.mapLabels() */ }

        <LayerGroup key={5}>
          { this.momentumMarkers()  }
        </LayerGroup>

        <LayerGroup key={4} className={"deceasedLayer"}>
          { this.projectedMarkers() }
        </LayerGroup>

        <LayerGroup key={3} className={"deceasedLayer"}>
          { this.confirmedMarkers() }
        </LayerGroup>

        <LayerGroup key={2} className={"deceasedLayer"}>
          { this.recoveredMarkers() }
        </LayerGroup>

        <LayerGroup key={1} className={"deceasedLayer"}>
          { this.deceasedMarkers() }
        </LayerGroup>
      </Map>
    );
  };

  /*reactSimpleMap = () => {
    return(
        <ComposableMap
        projection={"geoMercator"}
        projectionConfig={{scale: 200}}
        height={window.innerWidth}
        width={window.innerHeight - 50}
        style={{width: "100%", height: "100%"}}
      >
        <ZoomableGroup maxZoom={1000}>
          { this.geographies() }
          { this.momentumMarkers() }
          { this.projectedMarkers() }
          { this.confirmedMarkers() }
          { this.mapLabels() }
          { this.recoveredMarkers() }
          { this.deceasedMarkers() }
        </ZoomableGroup>
      </ComposableMap>
    )
  };*/

  /*geographies = () => {
    return (
      <Geographies geography={geoUrl}>
            {
              ({geographies}) =>
                geographies.map(geo => (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    onMouseEnter={() => {
                      const {NAME} = geo.properties;
                      if(NAME === "Antarctica") {
                        return;
                      }
                      let rowId = -1;
                      for(let c of this.confirmed) {
                        if(c.name === NAME) {
                          rowId = c.rowId;
                          break;
                        }
                      }
                      if(rowId < 0) {
			if (NAME === "United States of America") {
		          this.get_sums(NAME, ", US");
		        }
			      else if (NAME === "China") {
		          this.get_sums(NAME, ", China");
		        }
			      else if (NAME === "Australia") {
		          this.get_sums(NAME, ", Australia");
		        }
			      else if (NAME === "Canada") {
		          this.get_sums(NAME, ", Canada");
		        }
			      else if (NAME === "France") {
		          this.get_sums(NAME, ", France");
		        }

			      else { this.state.setTooltipContent(`Could not retrieve data for ${NAME}.`); }
                      } else {
                        let active = this.confirmed[rowId].val - this.recoveredAbsByRowId[rowId] - this.deathsAbsByRowId[rowId];
                        this.state.setTooltipContent(
                          <div>
                            <b>{NAME}</b> &nbsp;
                            <span><FontAwesomeIcon icon={faUsers}/> {rounded(Population.ABSOLUTE[NAME])}</span><br />
                            <span><FontAwesomeIcon icon={faBiohazard}/> {rounded(this.confirmed[rowId].val)} confirmed (>{rounded(this.projected[rowId].val)} at avg. test rate)</span><br/>
                            <span><FontAwesomeIcon icon={faProcedures}/> {rounded(active)} active</span>
                            &nbsp;<span><FontAwesomeIcon icon={faHeartbeat}/> {rounded(this.recovered[rowId].val)} recovered</span>
                            &nbsp;<span><FontAwesomeIcon icon={faHeartBroken}/> {rounded(this.deaths[rowId].val)} deceased</span>
                          </div>
                        );
                      }
                    }}
                    onMouseLeave={() => {
                      this.state.setTooltipContent("");
                    }}
                    style={{
                      default: {
                        fill: `#ddd`,
                        outline: "none"
                      },
                      hover: {
                        fill: `#999` ,
                        outline: "none"
                      },
                      pressed: {
                        fill: `#ddd`,
                        outline: "none"
                      }
                    }}
                  />
                ))
            }
          </Geographies>
    )
  };*/

  momentumMarkers = () => {
    return (
      this.state.momentum !== "none" &&
      this.confirmed.map(({rowId, name, coordinates, markerOffset, momentumLast1, momentumLast3, momentumLast7, valMin1, valMin3, valMin7}) => {
        let pop = Population.ABSOLUTE[name];
        let size;
        let val;
        switch (this.state.momentum) {
          case "last1":
            size = momentumLast1 - this.recovered[rowId].momentumLast1;
            val = valMin1 - this.recovered[rowId].valMin1;
            break;
          case "last3":
            size = momentumLast3 - this.recovered[rowId].momentumLast3;
            val = valMin3 - this.recovered[rowId].valMin3;
            break;
          case "last7":
            size = momentumLast7 - this.recovered[rowId].momentumLast7;
            val = valMin7 - this.recovered[rowId].valMin7;
            break;
          default:
            alert("something went wrong");
            console.log("something went wrong");
            break;
        }
        let pos = size >= 0;
        size = Math.abs(size);
        size = this.scaleLog(size);
        size = this.scalePpm(size, pop);
        size = this.scaleLogAndPpm(size);
        if (size > 0 && name !== "US, US") {
          return (
              <CircleMarker
                  key={"change_" + rowId}
                  style={this.state.chart === "pie" ? {display: "block"} : {display: "none"}}
                  center={[coordinates[1], coordinates[0]]}
                  fillColor={pos ? "#FF0000" : "#00FF00"}
                  radius={isNaN(size) ? 0 : Math.sqrt(size) * this.state.factor}
                  opacity={0}
                  fillOpacity={0.5}
              />
          );
        }
        return "";
      })
    )
  };

  /*<Marker coordinates={coordinates} key={"change_" + rowId}>
              <circle r={isNaN(size)?0:Math.sqrt(size) * this.state.factor} fill={pos ? "#F008" : "#0F08"} />
              <title>
                {`${name} - ${Math.abs(val)} ${pos ? "INCREASE" : "DECREASE"} in active(= confirmed-recovered) cases (excl. deceased) (${Math.round(ONE_M*val/pop)} ppm)`
                }
              </title>
              <text
                textAnchor="middle"
                y={markerOffset}
                style={{ fontSize: name.endsWith(", US") ? "0.005em" : "2px", fontFamily: "Arial", fill: "#5D5A6D33", pointerEvents: "none" }}
              >
                {name}
              </text>
            </Marker>*/

  projectedMarkers = () => {
    return (
      this.state.momentum==="none" && this.state.testmode &&
        this.projected.map(({ rowId, name, coordinates, markerOffset, size, val }) => {
          let color = "#00f";
          let pop = Population.ABSOLUTE[name];
          let active = val - this.recoveredAbsByRowId[rowId] - this.deathsAbsByRowId[rowId];
          size = this.scale(size, pop);
          let ppms = pop && !isNaN(val) ? '(' + Math.round(ONE_M * val / pop) + ' ppm)'  : '';
          let ppms2 = pop && !isNaN(active) ? '(' + Math.round(ONE_M * active / pop) + ' ppm)'  : '';
          let text = `${name} - could be >${rounded(val)} confirmed ${ppms}, >${rounded(active)} active ${ppms2} if local test rate was like global average test rate`;
          return this.marker(coordinates, rowId, color, text, size, val, name, markerOffset, "projected", 0.5);
        })
    )
  };

  confirmedMarkers = () => {
    return (
      this.state.momentum==="none" &&
        this.confirmed.map(({ rowId, name, coordinates, markerOffset, size, val }) => {
          let color = "#F00";
          let pop = Population.ABSOLUTE[name];
          let active = val - this.recoveredAbsByRowId[rowId] - this.deathsAbsByRowId[rowId];
          size = this.scale(size, pop);
          let ppms = pop && !isNaN(val) ? '(' + Math.round(ONE_M * val / pop) + ' ppm)'  : '';
          let ppms2 = pop && !isNaN(active) ? '(' + Math.round(ONE_M * active / pop) + ' ppm)'  : '';
          let text = `${name} - ${rounded(val)} confirmed ${ppms}, ${rounded(active)} active ${ppms2}`;
          return this.marker(coordinates, rowId, color, text, size, val, name, markerOffset, "confirmed", 0.5);
        })
    )
  };

  mapLabels = () => {
    return (
      this.confirmed.map(({ rowId, name, coordinates, markerOffset, size }) => {
        if (size > 0) {
          return (<Marker coordinates={coordinates} key={"label_" + rowId}>
            <text
                textAnchor="middle"
                y={markerOffset}
                style={{
                  fontSize: name.endsWith(", US") ? "1.5px" : "2px",
                  fontFamily: "Arial",
                  fill: "#5D5A6D33",
                  pointerEvents: "none"
                }}
            >
              {name}
            </text>
          </Marker>)
        }
        else {
          return ("");
        }
      })
    )
  };

  recoveredMarkers = () => {
    return (
      this.state.momentum==="none" &&
        this.recovered.map(({rowId, name, coordinates, markerOffset, size, val }) => {
          let color = "#0F0";
          let pop = Population.ABSOLUTE[name];
          if (this.state.chart === "pie" || this.state.chart === "pill") {
            size += this.deathsByRowId[rowId];
          }
          size = this.scale(size, pop);
          let ppms = pop && !isNaN(val) ? '(' + Math.round(ONE_M * val / pop) + ' ppm)' : '';
          let text = name + " - " + rounded(val) + " recovered " + ppms;
          return this.marker(coordinates, rowId, color, text, size, val, name, markerOffset, "recovered", 0.5);
        })
    )
  };

  deceasedMarkers = () => {
    return(
        this.state.momentum==="none" &&
          this.deaths.map(({rowId, name, coordinates, markerOffset, size, val }) => {
            let color = "#000";
            let pop = Population.ABSOLUTE[name];
            size = this.scale(size, pop);
            let ppms = pop && !isNaN(val) ? '(' + Math.round(ONE_M * val / pop) + ' ppm)'  : '';
            let text = name + " - " + rounded(val) + " deceased " + ppms;
            return this.marker(coordinates, rowId, color, text, size, val, name, markerOffset, "deceased", 0.8);
        })
    )
  };

  marker = (coordinates, rowId, color, text, size, val, name, markerOffset, type, opacity) => {
    if(size > 0 && name !== "US, US") {
      return (
        // bubble
        <CircleMarker
          className={type}
          key={type + "_" + rowId}
          style={this.state.chart === "pie" ? {display: "block"} : {display: "none"}}
          center={[coordinates[1], coordinates[0]]}
          fillColor={color}
          radius={size && size > 0 ? Math.sqrt(size) * this.state.factor : 0}
          opacity={0}
          fillOpacity={opacity}
        >
          <Tooltip direction="bottom" offset={[0, 20]} opacity={1}>
            {this.tooltip(name, rowId)}
          </Tooltip>
        </CircleMarker>
      );
    }
    return "";
  };


  tooltip = (name, rowId) => {
    try {
      let confirmed = this.confirmed[rowId].val;
      let projected = this.projected[rowId].val;
      let recovered = this.recovered[rowId].val;
      let deaths = this.deaths[rowId].val;
      let active = this.confirmed[rowId].val - this.recoveredAbsByRowId[rowId] - this.deathsAbsByRowId[rowId];

      let g1 = 0.5 * this.confirmed[rowId].momentumLast1; // growth factor
      let g3 = 0.3 * this.confirmed[rowId].momentumLast3; // growth factor
      let g7 = 0.2 * this.confirmed[rowId].momentumLast7; // growth factor
      let g = (g1 + g3 + g7);
      console.log(name + " : " + g)
      if(g <= 0) {
        g = 10;
      }
      else if(g <= 0.001) {
        g = 9;
      }
      else if(g <= 0.002) {
        g = 8;
      }
      else if(g <= 0.005) {
        g = 7;
      }
      else if(g <= 0.01) {
        g = 6;
      }
      else if(g <= 0.02) {
        g = 5;
      }
      else if(g <= 0.05) {
        g = 4;
      }
      else if(g <= 0.1) {
        g = 3;
      }
      else if(g <= 0.2) {
        g = 2;
      }
      else if(g <= 0.3) {
        g = 1;
      }
      else {
        g = 0;
      }

      let d1 = 0.5 * this.deaths[rowId].momentumLast1 / this.recovered[rowId].size; // death factor
      let d3 = 0.3 * this.deaths[rowId].momentumLast3 / this.recovered[rowId].size; // death factor
      let d7 = 0.2 * this.deaths[rowId].momentumLast7 / this.recovered[rowId].size; // death factor
      let d = 1 - (d1 + d3 + d7);

      let stayAtHomeScore = Math.round(g);
      if(confirmed < 100) {
        stayAtHomeScore = "N/A";
      }

      let lifeSaverScore = Math.round(d * 10);
      if(deaths < 100) {
        lifeSaverScore = "N/A";
      }
      return (
        <div>
          <div>
              <b>{name}</b><br />
              <FontAwesomeIcon icon={faUsers}/> {rounded(Population.ABSOLUTE[name])} &middot; <FontAwesomeIcon icon={faBiohazard}/> {rounded(confirmed)}
          </div>
          <div>
            <Badge variant={"danger"}><FontAwesomeIcon icon={faProcedures}/> {rounded(active)} active</Badge>
            <Badge className="ml-1" variant={"success"}><FontAwesomeIcon icon={faHeartbeat}/> {rounded(recovered)} recovered</Badge>
            <Badge className="ml-1" variant={"dark"}><FontAwesomeIcon icon={faHeartBroken}/> {rounded(deaths)} deceased</Badge><br />
            {
              projected > confirmed && this.state.testmode &&
              <Badge variant={"primary"}><FontAwesomeIcon icon={faBiohazard}/> &gt;{rounded(projected)} projected at global avg. testing rate</Badge>
            }
          </div>
          <div className="stayAtHomeScoreLabel">
            {
              [<span className="stayAtHomeAdvice">{this.stayAtHomeAdvice(active)}</span>, <br/>]
            }
            <table>
              <tr>
                <td valign={"top"}>
                  <div className={`stayAtHomeScore stayAtHomeScore${stayAtHomeScore}`}>
                    {stayAtHomeScore}{stayAtHomeScore !== "N/A" ? "/10" : ""}
                  </div>
                </td>
                <td>
                  <div>
                    <i>STAYING@HOME Score</i> reflects how well this region<br/>
                    responded to the spread of COVID19 in relation to their<br/>
                    local threat level over the past 14 days. Continue to follow<br />
                    the advice of the WHO and your local administration.
                  </div>
                </td>
              </tr>
              {/*<tr>
                <td valign={"top"}>
                  <div className={`stayAtHomeScore stayAtHomeScore${lifeSaverScore}`}>
                    {lifeSaverScore}{lifeSaverScore !== "N/A" ? "/10" : ""}
                  </div>
                </td>
                <td>
                  <div>
                    <i>LifeSaver Score</i> reflects how well this region can mitigate<br/>
                    fatalities from COVID19 in relation to their local threat <br/>
                    level over the past 14 days.
                  </div>
                </td>
              </tr>*/}
            </table>
          </div>
        </div>
      )
    } catch(e) {
      return "Could not load tooltip data.";
    }
  };

  stayAtHomeAdvice = (active) => {
    if(active > 150) {
      return "You save lives by staying at home today!"
    }
    if (active > 0) {
      return "Avoid crowds! Keep social distance!";
    }
    return "No active cases detected in this region.";
  };

      /*

        <Marker coordinates={coordinates} key={type + "_" + rowId}>
          // pill
          <rect
              fill={color + transparency}
              style={this.state.chart === "pill" ? {display: "block"} : {display: "none"}}
              x={isNaN(size) ? 0 : -size * this.state.factor / 2}
              y={-this.state.width / 2 * 3}
              height={(this.state.width < 0) ? 0 : this.state.width * 3}
              width={isNaN(size) ? 0 : (size * this.state.factor > 0) ? size * this.state.factor : 0}
              onMouseOver={() => {
                if (rowId < 0) {
                  this.state.setTooltipContent(`Could not retrieve data for ${name}.`);
                } else {
                  let active = that.confirmed[rowId].val - that.recoveredAbsByRowId[rowId] - that.deathsAbsByRowId[rowId];
                  this.state.setTooltipContent(
                      <div>
                        <b>{name}</b> &nbsp;
                        <span><FontAwesomeIcon icon={faUsers}/> {rounded(Population.ABSOLUTE[name])}</span><br/>
                        <span><FontAwesomeIcon
                            icon={faBiohazard}/> {rounded(that.confirmed[rowId].val)} confirmed (>{rounded(that.projected[rowId].val)} at avg. test rate)</span><br/>
                        <span><FontAwesomeIcon icon={faProcedures}/> {rounded(active)} active</span>
                        &nbsp;<span><FontAwesomeIcon
                          icon={faHeartbeat}/> {rounded(that.recovered[rowId].val)} recovered</span>
                        &nbsp;<span><FontAwesomeIcon
                          icon={faHeartBroken}/> {rounded(that.deaths[rowId].val)} deceased</span>
                      </div>
                  );
                }
              }}
              onMouseOut={() => {
                this.state.setTooltipContent("");
              }}
          />

          // bar
          <rect
              fill={color + transparency}
              style={this.state.chart === "bar" ? {display: "block"} : {display: "none"}}
              x={this.state.width * 3 * 2 - this.state.width * 3 * 1.5}
              y={isNaN(size) ? 0 : -size * this.state.factor}
              height={isNaN(size) ? 0 : (size * this.state.factor < 0) ? 0 : size * this.state.factor}
              width={(this.state.width < 0) ? 0 : this.state.width * 3}
              onMouseOver={() => {
                if (rowId < 0) {
                  this.state.setTooltipContent(`Could not retrieve data for ${name}.`);
                } else {
                  let active = that.confirmed[rowId].val - that.recoveredAbsByRowId[rowId] - that.deathsAbsByRowId[rowId];
                  this.state.setTooltipContent(
                      <div>
                        <b>{name}</b> &nbsp;
                        <span><FontAwesomeIcon icon={faUsers}/> {rounded(Population.ABSOLUTE[name])}</span><br/>
                        <span><FontAwesomeIcon
                            icon={faBiohazard}/> {rounded(that.confirmed[rowId].val)} confirmed (>{rounded(that.projected[rowId].val)} at avg. test rate)</span><br/>
                        <span><FontAwesomeIcon icon={faProcedures}/> {rounded(active)} active</span>
                        &nbsp;<span><FontAwesomeIcon
                          icon={faHeartbeat}/> {rounded(that.recovered[rowId].val)} recovered</span>
                        &nbsp;<span><FontAwesomeIcon
                          icon={faHeartBroken}/> {rounded(that.deaths[rowId].val)} deceased</span>
                      </div>
                  );
                }
              }}
              onMouseOut={() => {
                this.state.setTooltipContent("");
              }}
          />

          // bubble
          <circle
              fill={color + transparency}
              style={this.state.chart === "pie" ? {display: "block"} : {display: "none"}}
              r={size && size > 0 ? Math.sqrt(size) * this.state.factor : 0}
              onMouseOver={() => {
                if (rowId < 0) {
                  this.state.setTooltipContent(`Could not retrieve data for ${name}.`);
                } else {
                  let active = that.confirmed[rowId].val - that.recoveredAbsByRowId[rowId] - that.deathsAbsByRowId[rowId];
                  this.state.setTooltipContent(
                      <div>
                        <b>{name}</b> &nbsp;
                        <span><FontAwesomeIcon icon={faUsers}/> {rounded(Population.ABSOLUTE[name])}</span><br/>
                        <span><FontAwesomeIcon
                            icon={faBiohazard}/> {rounded(that.confirmed[rowId].val)} confirmed (>{rounded(that.projected[rowId].val)} at avg. test rate)</span><br/>
                        <span><FontAwesomeIcon icon={faProcedures}/> {rounded(active)} active</span>
                        &nbsp;<span><FontAwesomeIcon
                          icon={faHeartbeat}/> {rounded(that.recovered[rowId].val)} recovered</span>
                        &nbsp;<span><FontAwesomeIcon
                          icon={faHeartBroken}/> {rounded(that.deaths[rowId].val)} deceased</span>
                      </div>
                  );
                }
              }}
              onMouseOut={() => {
                this.state.setTooltipContent("");
              }}
          />

          <title>{text}</title>
        </Marker>
      */

  scale = (value, population) => {
    value = this.scaleIfPillOrBar(value);
    value = this.scaleLog(value);
    value = this.scalePpm(value, population);
    value = this.scaleLogAndPpm(value);
    return value;
  };

  scaleIfPillOrBar = (value) => {
    if(this.state.chart==="pill" || this.state.chart==="bar") {
      return value * 10;
    }
    return value;
  };

  scaleLog = (value) => {
    if(!this.state.logmode) {
      return value;
    }
    if(value > 0) {
      return Math.log(value * 10000) / 100;
    }
    return 0;
  };

  scalePpm = (value, population) => {
    if(!this.state.ppmmode) {
      return value;
    }
    if(population) {
      if(value > 0) {
        return ONE_M * value / population * 10;
      }
    }
    return 0;
  };

  scaleLogAndPpm = (value) => {
    if(this.state.logmode && this.state.ppmmode) {
      return value / 10;
    }
    return value;
  };

}

export default memo(MapChart);
