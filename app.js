let population = [];
let distChart = null;
let compareChart = null;

function mean(arr) {
  return arr.reduce((sum, val) => sum + val, 0) / arr.length;
}

function variance(arr, ddof = 0) {
  const m = mean(arr);
  const sqDiffs = arr.reduce((sum, val) => sum + Math.pow(val - m, 2), 0);
  return sqDiffs / (arr.length - ddof);
}

function stdDev(arr, ddof = 0) {
  return Math.sqrt(variance(arr, ddof));
}

function formatKES(num) {
  return (
    "KES " +
    Number(num).toLocaleString("en-KE", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

function formatNumber(num) {
  return Number(num).toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// Simple Random Sample Without Replacement (Fisher-Yates shuffle)
function drawSampleWithoutReplacement(arr, n) {
  const copy = [...arr];
  const size = Math.min(n, copy.length);
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, size);
}

function buildHistogramBins(values, binCount = 10) {
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const span = maxVal - minVal || 1;
  const step = span / binCount;

  const counts = new Array(binCount).fill(0);
  const labels = [];

  for (let i = 0; i < binCount; i++) {
    const start = minVal + i * step;
    const end = i === binCount - 1 ? maxVal : minVal + (i + 1) * step;
    labels.push(`${Math.round(start)}–${Math.round(end)}`);
  }

  for (const v of values) {
    let idx = Math.floor((v - minVal) / step);
    if (idx >= binCount) idx = binCount - 1;
    if (idx < 0) idx = 0;
    counts[idx]++;
  }

  return { labels, counts, minVal, step, binCount };
}

function mapSampleToBins(sample, binMeta) {
  const { minVal, step, binCount } = binMeta;
  const counts = new Array(binCount).fill(0);

  for (const v of sample) {
    let idx = Math.floor((v - minVal) / step);
    if (idx >= binCount) idx = binCount - 1;
    if (idx < 0) idx = 0;
    counts[idx]++;
  }
  return counts;
}

function renderPopulationKPIs() {
  const popMean = mean(population);
  const popVar = variance(population, 0);
  const popStd = stdDev(population, 0);
  const popTotal = population.reduce((a, b) => a + b, 0);

  document.getElementById("popCount").textContent = population.length.toLocaleString();
  document.getElementById("popMean").textContent = formatKES(popMean);
  document.getElementById("popStd").textContent = formatKES(popStd);
  document.getElementById("popVar").textContent = formatNumber(popVar);
  document.getElementById("popTotal").textContent = formatKES(popTotal);
}

function updateSimulation() {
  const n = Number(document.getElementById("sampleSize").value);
  document.getElementById("sampleSizeLabel").textContent = n;

  const sample = drawSampleWithoutReplacement(population, n);
  const popMean = mean(population);
  const sMean = mean(sample);
  const sVar = variance(sample, 1); // unbiased sample variance (n - 1)
  const error = Math.abs(sMean - popMean);
  const errorPct = ((error / popMean) * 100).toFixed(2);

  document.getElementById("sampleMean").textContent = formatKES(sMean);
  document.getElementById("sampleVar").textContent = formatNumber(sVar);
  document.getElementById("estError").textContent = formatKES(error);
  document.getElementById("errorPct").textContent = `${errorPct}% away from true mean`;

  updateCharts(sample, n, popMean, sMean);
}

function updateCharts(sample, n, popMean, sMean) {
  const binMeta = buildHistogramBins(population, 10);
  const sampleCounts = mapSampleToBins(sample, binMeta);

  const distCtx = document.getElementById("distChart").getContext("2d");
  if (distChart) distChart.destroy();

  distChart = new Chart(distCtx, {
    type: "bar",
    data: {
      labels: binMeta.labels,
      datasets: [
        {
          label: "Population (N = 1,800)",
          data: binMeta.counts,
          backgroundColor: "rgba(20, 83, 45, 0.25)",
          borderColor: "rgba(20, 83, 45, 0.85)",
          borderWidth: 1,
        },
        {
          label: `Active Sample (n = ${n})`,
          data: sampleCounts,
          backgroundColor: "rgba(14, 165, 233, 0.65)",
          borderColor: "rgba(14, 165, 233, 1)",
          borderWidth: 1,
        },
      ],
    },
    options: {
      responsive: true,
      scales: {
        y: {
          beginAtZero: true,
          title: { display: true, text: "Number of Transactions" },
        },
        x: {
          title: { display: true, text: "Transaction Amount (KES)" },
        },
      },
    },
  });

  const mean20 = mean(drawSampleWithoutReplacement(population, 20));
  const mean50 = mean(drawSampleWithoutReplacement(population, 50));
  const mean100 = mean(drawSampleWithoutReplacement(population, 100));

  const compCtx = document.getElementById("compareChart").getContext("2d");
  if (compareChart) compareChart.destroy();

  compareChart = new Chart(compCtx, {
    type: "bar",
    data: {
      labels: ["n = 20", "n = 50", "n = 100", `Selected (n = ${n})`, "True Mean (μ)"],
      datasets: [
        {
          label: "Mean Spend (KES)",
          data: [mean20, mean50, mean100, sMean, popMean],
          backgroundColor: [
            "#93c5fd",
            "#60a5fa",
            "#3b82f6",
            "#0ea5e9",
            "#14532d",
          ],
          borderRadius: 6,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        y: {
          beginAtZero: false,
          title: { display: true, text: "Mean Spend (KES)" },
        },
      },
    },
  });
}

async function initDashboard() {
  try {
    const response = await fetch("dashboard_data.json");
    if (!response.ok) {
      throw new Error("Could not load dashboard_data.json");
    }
    const data = await response.json();
    population = data.transaction_amounts_kes;

    if (!Array.isArray(population) || population.length === 0) {
      throw new Error("transaction_amounts_kes is empty");
    }

    renderPopulationKPIs();
    updateSimulation();
  } catch (err) {
    console.error(err);
    document.getElementById("popMean").textContent = "Run export first";
    alert(
      "Could not find dashboard_data.json in this folder yet. Export it from your Python notebook into the same folder as index.html, then refresh the page."
    );
  }
}

document.getElementById("sampleSize").addEventListener("input", updateSimulation);
document.getElementById("redrawBtn").addEventListener("click", updateSimulation);

document.querySelectorAll(".preset").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.getElementById("sampleSize").value = btn.dataset.n;
    updateSimulation();
  });
});

initDashboard();