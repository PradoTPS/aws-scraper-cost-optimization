import QuickChart from 'quickchart-js';

export default function generateLineChart({
  data,
  path,
  fileName,
  labels,
  lineLabel,
}) {
  const chart = new QuickChart();

  chart.setConfig({
    type: 'line',
    data: { labels, datasets: [{ label: lineLabel, data }] },
  });

  chart.toFile(`${path}/${fileName}`);
}
