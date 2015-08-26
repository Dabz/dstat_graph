/*
 * Disk
 */

function dsk_total_data(data) {
  for (idata in data) {
    ldata = data[idata];
    /* Byte to MB */
    data[idata].y = Math.round((data[idata].y / (1024 * 1024 * 1024) * 100 )) / 100;
  }

  return data;
}

function dsk_total_graph(graph) {
  graph.yAxis.axisLabel('Trafic (MB)').tickFormat(function(d) { return d3.format('.2f')(d); });
}

/*
 * CPU
 */

function total_cpu_usage_graph(graph) {
  graph.yAxis.axisLabel('%');
}


/*
 * Network
 */

function net_total_data(data) {
  for (idata in data) {
    ldata = data[idata];
    /* Byte to MB */
    data[idata].y = Math.round((data[idata].y / (1024 * 1024) * 100 )) / 100;
  }

  return data;
}

function net_total_graph(graph) {
  graph.yAxis.axisLabel('Trafic (MB)').tickFormat(function(d) { return d3.format('.2f')(d); });
}

/*
 * MongoDB
 */

function mongodb_stats_graph(graph) {
  graph.yAxis.axisLabel('Size (MB)').tickFormat(function(d) { return d3.format('d.0')(d); });
}

function mongodb_con_graph(graph) {
  graph.yAxis.axisLabel('Connection').tickFormat(function(d) { return d3.format('d.0')(d); });
}

function mongodb_mem_graph(graph) {
  graph.yAxis.axisLabel('Size (MB)').tickFormat(function(d) { return d3.format('d.0')(d); });
}
