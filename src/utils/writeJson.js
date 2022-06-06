import fs from 'fs';

export default function generateLineChart({
  data,
  path,
  fileName,
}) {
  const json = JSON.stringify(data, null, 2);

  fs.writeFile(`${path}/${fileName}`, json, 'utf8');

  return true;
}
