import generateLineChart from 'Utils/generateLineChart';

/**
* @command sls invoke local -f GenerateChart -p tests/events/generateChart.json
*/
export async function main (options) {
  const {
    records
  } = options;

  options.data = records.map(([x, _]) => x);
  options.labels = records.map(([_, y]) => y);

  return generateLineChart(options);
};
