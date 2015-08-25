
/*
 * Global variables
 */

gGraphs = {};

var brush = d3.svg.brush()
  .on("brushend", brushed);

var margin = {top: 10, right: 10, bottom: 100, left: 40},
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
    $('#drop').css('border', '4px dashed #fff')
  });
$(document).on('dragover', function (e) {
  e.stopPropagation();
  e.preventDefault();
  $('#drop').css('border', '4px dashed red')
});
$(document).on('drop', function (e) {
  e.stopPropagation();
  e.preventDefault();
  processFiles(e.originalEvent.target.files || e.originalEvent.dataTransfer.files);
  $('#drop-background').hide();
});


/*
 * Processing functions
 */

function processFiles(files) {
  for (f = 0; file = files[f]; f++) {
    processFile(file);
  }
}

function processFile(file) {
  reader = new FileReader();
  reader.onload = function(e) {
    text = reader.result;
    processCSV(text, file.name);
  }

  reader.readAsText(file);
}

function processCSV(csv, filename) {
  lines   = csv.split('\n');
  host    = lines[2].replace(/"/g, '').split(',')[1];
  groups  = lines[4].replace(/"/g, '').split(',');
  headers = lines[5].replace(/"/g, '').split(',');

  graphs  = [];
  map     = [];
  gindex  = -1;
  nlines  = lines.length - 6;

  /* Browse headers */
  for (i = 0, j = 0; i < headers.length; i++, j++) {
    if (groups[i] != "") {
      last_group         = groups[i];
      j                  = 0;
      graphs.push({name: last_group, d: []});
      gindex++;
    }

    graphs[gindex].d.push({key: headers[i], values: []});
    map[i] = {group: gindex, index: j, name: headers[i]};
  }

  xValues = getValues(graphs, 'system', 'time');
  /* Use time for XAxis */
  if (xValues !== null) {
    graphs.xAxis = function (xa) { xa.axisLabel('Time').tickFormat(function(d) { return d3.time.format('%Hh %Mm %Ss')(new Date(d)); }) };
    for (lindex = 6, iindex = 0; lindex < lines.length; lindex++, iindex++) {
      line = lines[lindex].replace(/"/g, '').split(',');
      for (cindex = 0; cindex < line.length; cindex++) {
        lmap = map[cindex];
        if (lmap.name === 'time') {
          xValues.push(Date.parse(line[cindex].replace(/(\d+)-(\d+)\s+(\d+):(\d+):(\d+)/, '1942/$2/$1 $3:$4:$5')));
          break;
        }
      }
    } /* Use sequence for xAxis */
  } else {
      xValues = Array.apply(null, Array(nlines)).map(function (_, i) {return i;});
      graphs.xAxis = function (xa) { xa.axisLabel('').tickFormat(function(d) { return d3.format('d')(new Date(d)); }) };
  }

  /* Populate graph data */
  for (lindex = 6, iindex = 0; lindex < lines.length; lindex++, iindex++) {
    line = lines[lindex].replace(/"/g, '').split(',');
    for (cindex = 0; cindex < line.length; cindex++) {
      lmap = map[cindex];
      if (lmap.name != 'time') {
        nVal = parseFloat(line[cindex]);
        /* non numerical line */
        if (isNaN(nVal)) {
          val = line[cindex]
          graphs[lmap.group].yformat = function(_) {return _};
        }
        else {
          val = nVal
          graphs[lmap.group].yformat = d3.format('<-,02f');
        }

        graphs[lmap.group].d[lmap.index].values.push({y: val, x: xValues[iindex]});
      }
    }
  }

  /* Create the brush */
  dmin = graphs[1].d[1].values[0].x;
  dmax = graphs[1].d[0].values[graphs[1].d[0].values.length -1].x;
  if (lines.length > 500) {
    dmin = graphs[1].d[0].values[graphs[1].d[0].values.length - 500].x;
  }

  displayFocusGraph(graphs, dmin, dmax);

  /* create & display the graphs */
  for (gindex = 0; gindex <  graphs.length; gindex++) {
    if (graphs[gindex].name != "system" && graphs[gindex].d[0].key != "time") {
      graphName   = graphs[gindex].name;
      graphData   = graphs[gindex].d;
      graphFormat = graphs[gindex].yformat;
      panel = createPanel(graphName, graphData, host)
      displayGraph(graphName, graphData, graphFormat, panel, dmin, dmax);
    }
  }
}


function createPanel(graphName, graphData, filename) {
  id  = graphName.replace(/[&\/\\#,+()$~%.'":*?<>{}\s]/g,'_');
  div = d3.select('#' + id);

  if (div.empty()) {
    div = d3.select('#dashboard').append('div').attr('class', ' list-group-item').attr('id', id);
    header = div.append('div').attr('class', 'panel-heading').append('h3').attr('class', 'panel-title');
    header.append('span').text(graphName);
    header.append('span').attr('class', 'glyphicon glyphicon-chevron-right pull-right clickable');
  }

  elt = div.append('div').attr('class', 'row list-body');
  elt.append('p').text(filename)
  elt.append('svg').datum(reduceData(graphData));

  return div;
}



function displayGraph(graphName, graphData, graphFormat, panel, dmin, dmax) {
  panel.selectAll('svg').each(function() {
      var elt = d3.select(this);

      nv.addGraph(function() {
          var chart = nv.models.lineChart()
            .margin({left: 100})
            .useInteractiveGuideline(true)
            .showLegend(true)
          ;

          graphs.xAxis(chart.xAxis);
          chart.yAxis.tickFormat(graphFormat);

          elt.call(chart);
          nv.utils.windowResize(chart.update);

          pb = d3.select(elt[0][0].parentNode.parentNode).select('.clickable').on("click", function() {
            pb = d3.select(this.parentNode.parentNode.parentNode).selectAll('.list-body');
            isHidden = pb.style('display') == 'none';
            pb.style('display', isHidden ? 'inherit' : 'none');
            chart.update()
          });

          return chart;
        }, function(chart) {
          if (gGraphs[graphName] == undefined) gGraphs[graphName] = [];
          gGraphs[graphName].push({elt: elt, chart: chart, data: graphData});
        });
    });
}

function getValues(graphs, group, header) {
  for (i in graphs) {
    if (graphs[i].name == group) {
      for (j in graphs[i].d) {
        if (graphs[i].d[j].key == header) {
          return graphs[i].d[j].values;
        }
      }
    }
  }

  return null;
}

function getExists(graphs, group, header) {
  for (i in graphs) {
    if (graphs[i].name == group) {
      for (j in graphs[i].d) {
        if (graphs[i].d[j].key == header) {
          return true;
        }
      }
    }
  }

  return false;
}

var displayFocusGraphInitialized = false;
function displayFocusGraph(graphs, dmin, dmax) {
  if (displayFocusGraphInitialized) {
    return;
  }

  displayFocusGraphInitialized = true;
  data = getValues(graphs, "total cpu usage", "idl").map(function(idl) { return {x: idl.x, y: (100 - parseFloat(idl.y)) };});

  x.domain(d3.extent(data.map(function(val) { return val.x })));
  y.domain([0, d3.max(data.map(function(val) { return val.y }))]);

  brush.x(x)
    .extent([dmin, dmax]);

  var area = d3.svg.area()
    .interpolate("monotone")
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
  ext  = (brush.empty() || brush.extent() == null ? x.domain() : brush.extent());
  extD = [ext[0] instanceof String ? Date.parse(ext[0]) : ext[0],
          ext[1] instanceof String ? Date.parse(ext[1]) : ext[1]];

  ndata = data.map(function(d, i) {
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
  ext  = (brush.empty() || brush.extent() == null ? x.domain() : brush.extent());

  for (var name in gGraphs) {
    if (gGraphs.hasOwnProperty(name)) {
      for (gIndex in gGraphs[name]) {
        graph = gGraphs[name][gIndex];
        chart = graph.chart;
        elt   = graph.elt;
        data  = graph.data;
        ndata = reduceData(data);
        chart.xDomain(ext);

        elt.call(chart.xAxis);
        elt.datum(ndata);

        elt.call(chart.update);
      }
    }
  }
}
