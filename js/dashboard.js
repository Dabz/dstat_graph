/*
 * Global variables
 */
var gGraphs = {};
var gCSVs   = [];
var gFiles  = [];

var brush = d3.svg.brush()
  .on("brushend", brushed);

var margin = {top: 10, right: 10, bottom: 30, left: 40},
    height = 70 - margin.top,
    width  = 600 - margin.right - margin.left;

var x = d3.time.scale().range([0, width]),
    y = d3.scale.linear().range([height, 0]);


/*
 * DOM functions
 */
$(document).on('dragenter', function (e) {
    e.stopPropagation();
    e.preventDefault();
    $('#drop').css('border', '4px solid #fff')
  });
$(document).on('dragover', function (e) {
  e.stopPropagation();
  e.preventDefault();
  $('#drop').css('border', '4px solid red')
});
$(document).on('drop', function (e) {
  e.stopPropagation();
  e.preventDefault();
  processFiles(e.originalEvent.target.files || e.originalEvent.dataTransfer.files);
  $('#drop-background').hide();
});


/*
 * Init functions
 */
$(document).ready(function() {
  // initialize graphs contained in gCSVs
  if (gCSVs !== undefined && gCSVs.length > 0) {
    $('#drop-background').hide();
    for (let i = 0; i < gCSVs.length; ++i) {
      processCSV(gCSVs[i], "csv " + i)
    }
  }
})


/*
 * Settings functions
 */
var settings = {
  "interface": "standard",
  "xaxis": 'time',
  "granularity": undefined, // set while browsing the first file
  "agg_function": "avg"
}


/*
 * CSV Processing functions
 */
function processFiles(files) {
  if ((files.length + gFiles.length) > 1) { // switch to sequential if multiple files are present
    settings.xaxis = 'sequential';
  }
  for (i = 0; i < files.length; i++) {
    gFiles.push(files[i]);
    processFile(files[i]);
  }
}

function processFile(file) {
  var reader = new FileReader();
  var name   = file.name;
  reader.onload = function(e) {
    text = e.target.result;
    processCSV(text, name);
  }

  reader.readAsText(file);
}

/*
 * return dstat header end line
 * TODO: Improve the detection mechanism
 */
function findHeaderEnd(lines) {
  host   = "";
  dataIn = -1

  // Let's browse only 20 lines, if there is more, it could mean it's not a valid file
  for (var i = 0; i < 20; i++) {
    line = lines[i].replace(/"/g, '').split(',');
    if (line[0] == "Host:") {
      host = line[1]
    }
    if (lines[i].length > 0 && lines[i][0] != '"') {
      dataIn = i;
      break;
    }
  }

  // Not a valid file
  if (dataIn == -1) {
    return null;
  }

  return { "host"    : host,
           "groups"  : lines[dataIn - 2].replace(/"/g, '').split(','),
           "headers" : lines[dataIn - 1].replace(/"/g, '').split(','),
           "nlines"  : lines.length - dataIn,
           "dataIn"  : dataIn
         };
}

/*
 * Entry point for parsing CSV
 * CSV file is read and dispatch line by line in a 2D array
 * Then we browse these 2D array to create the required d3 structure
 *
 */
function processCSV(csv, filename) {
  lines   = csv.split('\n');
  l_env   = findHeaderEnd(lines);

  if (l_env == null) {
    alert('Non valid CSV file: ' + filename + '. Failed at parsing header')
    return;
  }

  host    = l_env.host;
  groups  = l_env.groups;
  headers = l_env.headers;
  nlines  = l_env.nlines;
  graphs  = [];
  map     = [];
  gindex  = -1;

  /* Browse headers */
  for (var i = 0, j = 0; i < headers.length; i++, j++) {
    if (groups[i] != "") {
      last_group         = groups[i];
      j                  = 0;
      graphs.push({name: last_group, d: []});
      gindex++;
    }

    graphs[gindex].d.push({key: headers[i], values: []});
    map[i] = {group: gindex, index: j, name: headers[i]};
  }

  /* try to increase granularity to reduce memory consumption if required */
  // TODO be smarter here, save different configuration per file?

  if (settings.granularity === undefined) {
    if (lines.length > 7200) {
      settings.granularity = 15
    }  else if (lines.length > 3600) {
      settings.granularity = 5
    } else {
      settings.granularity = 1
    }
  }

  // First, let's merge headers and groups in a single object
  xValues = getValues(graphs, 'system', 'time');
  /* Use time for XAxis */
  if (xValues !== null && settings.xaxis == "time") {
    graphs.xAxis = function (xa) {
      xa.axisLabel('Time').tickFormat(function(d) {
          if (typeof d === 'string') {
            return d;
          }
          return d3.time.format('%Hh %Mm %Ss')(new Date(d));
        })
    };
    for (var lindex = l_env.dataIn, iindex = 0; lindex < lines.length; lindex++, iindex++) {
      line = lines[lindex].replace(/"/g, '').split(',');
      for (var cindex = 0; cindex < line.length; cindex++) {
        lmap = map[cindex];
        if (lmap != null && lmap.name === 'time' && line[cindex].length > 0) {
          xValues.push(Date.parse(line[cindex].replace(/(\d+)-(\d+)\s+(\d+):(\d+):(\d+)/, '1942/$2/$1 $3:$4:$5')));
          break;
        }
      }
    } /* Use sequence for xAxis */
  } else {
      xValues = d3.range(nlines);
      graphs.xAxis = function (xa) {
        xa.axisLabel('').tickFormat(function(d) {
            return d3.format('d')(d);
          })
      };
  }

  /* Then, populate the graphs object with the CSV values, aggregate data while browsing */
  tmp_values = {}
  for (var lindex = l_env.dataIn, iindex = 0; lindex < lines.length; lindex++, iindex++) {
    line = lines[lindex].replace(/"/g, '').split(',');
    for (var cindex = 0; cindex < line.length; cindex++) {
      lmap = map[cindex];
      if (lmap != null && lmap.name != 'time') {
        nVal = parseFloat(line[cindex]);
        /* handle non numerical line */
        if (isNaN(nVal)) {
          val = line[cindex]
          graphs[lmap.group].yformat = function(_) {return _};
        }
        else {
          val = nVal
          graphs[lmap.group].yformat = d3.format('<-,02f');
        }

        if (tmp_values[lmap.group] == undefined) {
          tmp_values[lmap.group] = []
        }
        if (tmp_values[lmap.group][lmap.index] == undefined) {
          tmp_values[lmap.group][lmap.index] = []
        }
        tmp_values[lmap.group][lmap.index].push(val)

        if (!((iindex + 1) % settings.granularity)) { // add a new entry in the graph
          if (settings.agg_function == "avg") {
            graphs[lmap.group].d[lmap.index].values.push({y: tmp_values[lmap.group][lmap.index].average(), x: xValues[iindex]});
          } if (settings.agg_function == "max") {
            graphs[lmap.group].d[lmap.index].values.push({y: Math.max(...tmp_values[lmap.group][lmap.index]), x: xValues[iindex]});
          }
          tmp_values = {}
        }
      }
    }
  }

  /* Apply specificities for each data headers */
  for (var i in graphs) {
    name       = graphs[i].name;
    name       = name.replace(/[&\/\\#,+()$~%.'":*?<>{}\s]/g,'_');
    sfname     = name + "_data";
    ofname     = name + "_options";
    gdfunction = undefined;
    options    = {};

    if (typeof window[sfname] == "function") {
      gdfunction = window[sfname];
    }
    if (typeof window[ofname] == "function") {
      options = window[ofname]();
    }
    for (var j in graphs[i].d) {
      if (gdfunction !== undefined) {
        graphs[i].d[j].values = gdfunction(graphs[i].d[j].values);
      }
      if (options !== undefined) {
        if (options.area === true) {
          graphs[i].d[j].area = true;
        }
      }
    }
  }

  /* Create the brush */
  dmin = graphs[1].d[1].values[0].x;
  dmax = graphs[1].d[0].values[graphs[1].d[0].values.length -1].x;
  // If there is many point, let's start by focusing on the last ones to reduce loading time
  if ((lines.length / settings.granularity) > 500) {
    dmin = graphs[1].d[0].values[graphs[1].d[0].values.length - 500].x;
  }

  displayFocusGraph(graphs, dmin, dmax);

  /* create & display the graphs */
  for (var gindex = 0; gindex <  graphs.length; gindex++) {
    if (graphs[gindex].name != "system" && graphs[gindex].d[0].key != "time") {
      graphName   = graphs[gindex].name;
      graphData   = graphs[gindex].d;
      graphFormat = graphs[gindex].yformat;
      panel = createPanel(graphName, graphData, filename)
      displayGraph(graphName, graphData, graphFormat, panel, dmin, dmax, filename);
    }
  }
}


/*
 * Create or use an already existing panel to display the graph
 */
function createPanel(graphName, graphData, filename) {
  id  = graphName.replace(/[&\/\\#,+()$~%.'":*?<>{}\s]/g,'_');
  data = reduceData(graphData)
  div = d3.select('#' + id);

  if (! settings.compact) {
    if (div.empty()) {
      div = d3.select('#dashboard').append('li').attr('class', ' list-group-item').attr('id', id);
      header = div.append('h3').text(graphName);
    }
    elt = div.append('p').text(filename)
    elt.append('svg').datum(reduceData(graphData));
  } else if (settings.compact) {
    if (div.empty()) {
      div    = d3.select('#dashboard').append('div').attr('class', 'list-group-item-compact').attr('id', id);
      header = d3.select('#dashboard').append('div').attr('class', 'panel-left')
      info   = d3.select('#dashboard').append('div').attr('class', 'panel-left')

      d3.select('#dashboard').append('div').attr('class', 'panel-clear')
      header.append('p').attr('class', 'panel-left').text(graphName)
      colors = nv.utils.getColor()
      for (var i in graphData) {
        header.append('p').attr('class', 'panel-left').text(graphData[i].key).style({color: colors(i), 'margin-left': '15px'});
      }
    }
    elt = div.append('div').attr('class', 'row list-body');
    elt.append('svg').datum(data);
  }

  return div;
}

/*
 * Create generic graph options
 */
function createInitialOptions(graphData) {
  options = {}

  return options;
}

/*
 * Create the graph d3 object
 */
function displayGraph(graphName, graphData, graphFormat, panel, dmin, dmax, filename) {
  panel.selectAll('svg').each(function() {
      var elt = d3.select(this);

      nv.addGraph(function() {
          var graphId    = graphName.replace(/[&\/\\#,+()$~%.'":*?<>{}\s]/g,'_');
          var graphFu    = graphId + '_graph';
          var graphFuPre = graphId + '_options';
          var options    = createInitialOptions(graphData);
          var chart = null;

          if (typeof window[graphFuPre] == "function") {
            options = window[graphFuPre]();
          }

          if (options.type == 'stacked') {
            chart = nv.models.stackedAreaChart()
              .margin({left: 100})
              .useInteractiveGuideline(! settings.compact)
              .showLegend(! settings.compact)
              .style('expand')
              .interpolate("basis")
              .showControls(false)
              .showXAxis(! settings.compact)
              .showYAxis(true)
              ;
          } else if (options.type == 'pie') {
            chart = nv.models.bulletChart()
              .margin({left: 100})
              ;
          } else {
            chart = nv.models.lineChart()
              .margin({left: 100})
              .useInteractiveGuideline(! settings.compact)
              .interpolate("basis")
              .showLegend(! settings.compact)
              .showXAxis(! settings.compact)
              .showYAxis(true)
            ;
          }


          graphs.xAxis(chart.xAxis);

          if (typeof window[graphFu] == "function") {
            window[graphFu](chart);
          }

          var pb = d3.select(elt[0][0].parentNode.parentNode).select('.clickable').on("click", function() {
            pb = d3.select(this.parentNode.parentNode.parentNode).selectAll('.list-body');
            isHidden = pb.style('display') == 'none';
            pb.style('display', isHidden ? 'inherit' : 'none');
            chart.update()
          });

          elt.call(chart);
          nv.utils.windowResize(chart.update);

          return chart;
        }, function(chart) {
          if (gGraphs[graphName] == undefined) gGraphs[graphName] = {};
          gGraphs[graphName][filename] = {elt: elt, chart: chart, data: graphData, filename: filename};
        });
    });
}

function getValues(graphs, group, header) {
  for (var i in graphs) {
    if (graphs[i].name == group) {
      for (var j in graphs[i].d) {
        if (graphs[i].d[j].key == header) {
          return graphs[i].d[j].values;
        }
      }
    }
  }

  return null;
}

function getExists(graphs, group, header) {
  for (var i in graphs) {
    if (graphs[i].name == group) {
      for (var j in graphs[i].d) {
        if (graphs[i].d[j].key == header) {
          return true;
        }
      }
    }
  }

  return false;
}

/*
 * Create the focus graph
 * By default, use the oposite of idle cpu time
 * If not found in the CSV, take the first element
 */
function displayFocusGraph(graphs, dmin, dmax) {
  if ($('#focus').children().length > 0) {
    return;
  }

  /* original dstat has "total cpu usage" with fields "usr", "idl" ...
   * pcp dstat has "total usage" with fields "total usage:usr", "total usage:sys" ...
   */
  if (getExists(graphs, "total usage", "total usage:idl")) {
    data = getValues(graphs, "total usage", "total usage:idl")
  } else if (getExists(graphs, "total cpu usage", "idl")) {
    data = getValues(graphs, "total cpu usage", "idl")
  } else {
    alert("Failed to parse: idle CPU stats not found")
  }

  if (data) { // Rollback to the first element if not found
    data = data.map(function(idl) { return {x: idl.x, y: (100 - parseFloat(idl.y)) };});
  }
  else {
    data = graphs[0].d[0].values;
    data = data.map(function(idl) { return {x: idl.x, y: idl.y };});
  }

  x.domain(d3.extent(data.map(function(val) { return val.x })));
  y.domain([0, d3.max(data.map(function(val) { return val.y }))]);

  brush.x(x).extent([dmin, dmax]);

  var area = d3.svg.area()
    .interpolate("basis")
    .x(function(d) { return x(d.x) })
    .y1(function(d) { return y(d.y) })
    .y0(height);

  var svg = d3.select('#focus').append('svg')
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom);

  var xAxis = d3.svg.axis().scale(x).orient("bottom");

  svg.append("defs").append("clipPath")
    .attr("id", "clip")
    .append("rect")
    .attr("width", width)
    .attr("height", height);

  context = svg.append("g")
    .attr("class", "context")
    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

  context.append("path")
    .datum(data)
    .attr("class", "area")
    .attr("d", area);

  context.append("g")
    .attr("class", "x axis")
    .attr("transform", "translate(0," + height + ")")
    .call(xAxis.ticks(5));

  context.append("g")
    .attr("class", "x brush")
    .call(brush)
    .selectAll("rect")
    .attr("y", -6)
    .attr("height", height + 7);

  brushed();
}

function reduceData(data) {
  var ext  = (brush.empty() || brush.extent() == null ? x.domain() : brush.extent());
  var extD = [ext[0] instanceof String ? Date.parse(ext[0]) : ext[0],
             ext[1] instanceof String ? Date.parse(ext[1]) : ext[1]];

  var ndata = data.map(function(d, i) {
    return {
      key: d.key,
      area: d.area,
      values: d.values.filter(function(d, i) {
        return d.x > extD[0] && d.x < extD[1];
      })
  }});
  return ndata;
}


function brushed() {
  var ext  = (brush.empty() || brush.extent() == null ? x.domain() : brush.extent());

  for (var name in gGraphs) {
    if (gGraphs.hasOwnProperty(name)) {
      for (gIndex in gGraphs[name]) {
        var graph = gGraphs[name][gIndex];
        var chart = graph.chart;
        var elt   = graph.elt;
        var data  = graph.data;
        var ndata = reduceData(data);

        chart.xDomain(ext);
        elt.call(chart.xAxis);
        elt.datum(ndata);

        elt.call(chart.update);
      }
    }
  }
}

function change_xaxis(type) {
  settings.xaxis = type;
  refresh();
}

function change_interface(type) {
  settings.compact = (type == 'compact');
  refresh();
}

function change_granularity(granularity, aggr_function) {
  settings.granularity = granularity
  settings.agg_function = aggr_function
  refresh();
}

/*
 * Destroy all graphs & the focus bars
 * and recreate them using the content of
 * gFiles (all uploaded files)
 */
function refresh() {
  d3.select('#dashboard').html("");
  d3.select('#focus').html("");
  for (i in gFiles) {
    processFile(gFiles[i]);
  }
}


/*
 * Toggle header menu
 */
function toggle_menu() {
  if ($('#menu').is(":hidden")) {
    $('#menu').slideDown('slow');
    $('#dashboard').animate({ "padding-top": "+=50px" }, 'slow');
  } else {
    $('#menu').slideUp('slow');
    $('#dashboard').animate({ "padding-top": "-=50px" }, 'slow');
  }
}

/*
 * Type extension
 */
Array.prototype.sum = Array.prototype.sum || function() {
  return this.reduce(function(sum, a) { return sum + Number(a) }, 0);
}

Array.prototype.average = Array.prototype.average || function() {
  return this.sum() / (this.length || 1);
}
