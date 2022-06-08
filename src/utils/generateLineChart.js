import QuickChart from 'quickchart-js';

export default function generateLineChart({
  data,
  path,
  fileName,
  labels,
  lineLabel,
  yAxesUnstacked = true
}) {
  const chart = new QuickChart();

  chart.setConfig({
    type: 'line',
    data: { labels, datasets: [{ label: lineLabel, data }] },
    options: { scales: { yAxes: { stacked: yAxesUnstacked }}}
  });

  chart.toFile(`${path}/${fileName}`);
}