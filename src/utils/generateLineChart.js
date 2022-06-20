import QuickChart from 'quickchart-js';

export default function generateLineChart({
  data,
  path,
  fileName,
  labels,
  lineLabel,
  yAxesUnstacked = true,
  annotation = null,
}) {
  const chart = new QuickChart();

  chart.setConfig({
    type: 'line',
    data: { labels, datasets: [{ label: lineLabel, data }] },
    options: {
      scales: {
        yAxes: { stacked: yAxesUnstacked }
      },
      ...(
        annotation && {
          annotation: {
            annotations: [{
              type: 'line',
              mode: 'horizontal',
              scaleID: 'y-axis-0',
              value: annotation,
              borderColor: 'red',
              borderWidth: 1,
              label: {
                enabled: true,
                content: 'SLA',
                position: 'bottom',
                yAdjust: 10
              }
            }]
          }
        }
      ),
    }
  });

  chart.toFile(`${path}/${fileName}`);
}