# Supermarket Transaction Insights — Statistical & Sampling Explorer

An interactive web dashboard built to explore customer spending across **1,800 supermarket transactions (in KES)** and compare true population parameters against live simple random sampling without replacement.

## Overview

- **Population Parameters ($N = 1,800$):** Displays the true population mean ($\mu$), population standard deviation ($\sigma$), population variance ($\sigma^2$), and total transaction volume.
- **Live Random Sampling Simulator:** Lets you adjust sample size ($n$), redraw samples without replacement, and inspect the sample mean ($\bar{x}$), unbiased sample variance ($s^2$ using $n - 1$), and estimation error ($|\bar{x} - \mu|$ and percentage error).
- **Visualizations:** Compares the transaction spending distribution (population vs. active sample) and shows mean convergence across sample sizes ($n = 20, 50, 100$, and the selected sample).

## Project Structure

- `index.html` — Dashboard layout and KPI/simulator containers
- `style.css` — Styling for cards, controls, and charts
- `app.js` — Statistical calculations, sampling simulation, and chart rendering
- `dashboard_data.json` — Exported transaction dataset (`transaction_amounts_kes`)
- `README.md` — Project documentation
-