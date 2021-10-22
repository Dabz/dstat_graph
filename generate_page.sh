#!/bin/bash

##
## generate_page.sh
##
## Made by gaspar_d
## Login   <d.gasparina@gmail.com>
##
## Started on  Tue 23 Feb 20:17:04 2016 gaspar_d
## Last update Wed 11 May 17:54:27 2016 gaspar_d
##

print_usage() {
  cat <<EOF
OVERVIEW: generate a standalone HTML page that you can share with your colleagues
USAGE: $0 file1.csv file2.csv ...
EOF

}

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
  for js in js/{d3.min,jquery-3.6.0.min,nv.d3.min,bootstrap.bundle.min,dashboard,graph}.js; do
    echo "<script type='text/javascript'>"
    cat ${js}
    echo
    echo "</script>"
  done
  echo "<script type='text/javascript'>gCSVs=${gCSVs};</script>"
  for css in css/*.css; do
    echo "<style>"
    cat ${css}
    echo
    echo "</style>"
  done

  echo "</body>"
  echo "</html>"
}


if [ $# -eq 0 ]; then
  print_usage $0
  exit 1
fi

main $@
