#!/bin/sh

##
## pregeneratehtml.sh
##
## Made by gaspar_d
## Login   <d.gasparina@gmail.com>
##
## Started on  Tue 23 Feb 20:17:04 2016 gaspar_d
## Last update Tue 23 Feb 21:08:26 2016 gaspar_d
##

main() {
  gCSVs=""

  while [[ "$#" -gt "0" ]]; do
    file=$1
    content=`cat $file`
    gCSVs="${gCSVs}\`${content}\`,"
    shift;
  done
  gCSVs="[${gCSVs%?}]"
  output=$1

  html=`cat index.html | grep -v stylesheet | grep -v script | grep -v '</body>'`
  echo $html
  for js in js/{d3.min.js,jquery-2.1.4.js,nv.d3.min.js,dashboard.js,graph.js}; do
    echo "<script type='text/javascript'>"
    cat ${js}
    echo "</script>"
  done
  echo "<script type='text/javascript'>gCSVs=${gCSVs};</script>"
  for css in css/*.css; do
    echo "<style>"
    cat ${css}
    echo "</style>"
  done

  echo "</body>"
}


main $@
