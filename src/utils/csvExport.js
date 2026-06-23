export function downloadCSV(filename, rows, headers) {
  const lines = [headers.join(',')];
  rows.forEach(r => {
    lines.push(headers.map(h => {
      const v = r[h] ?? '';
      return typeof v === 'string' && v.includes(',') ? `"${v}"` : v;
    }).join(','));
  });
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportMonteCarloResults(mcResults) {
  const rows = mcResults.equal.trialData.map((eq, i) => {
    const opt = mcResults.optimised.trialData[i];
    return {
      trial: eq.trial,
      eq_meanWait: eq.meanWait, opt_meanWait: opt.meanWait,
      eq_maxQueue: eq.maxQueue, opt_maxQueue: opt.maxQueue,
      eq_throughput: eq.throughput, opt_throughput: opt.throughput,
      eq_carsLeft: eq.carsLeft, opt_carsLeft: opt.carsLeft,
      eq_fairnessSD: eq.fairnessSD, opt_fairnessSD: opt.fairnessSD,
    };
  });
  downloadCSV('monte_carlo_results.csv', rows, [
    'trial','eq_meanWait','opt_meanWait','eq_maxQueue','opt_maxQueue',
    'eq_throughput','opt_throughput','eq_carsLeft','opt_carsLeft',
    'eq_fairnessSD','opt_fairnessSD',
  ]);
}

export function exportTimeSeries(timeSeries, label) {
  downloadCSV(`timeseries_${label}.csv`, timeSeries,
    ['t','qN','qS','qE','qW','activeDir','cycleNum']);
}

export function exportSummaryTable(compTable) {
  downloadCSV('comparison_table.csv', compTable,
    ['metric','equal','opt','diff','improvement']);
}
