**Live site:** https://bouwles.github.io/Four-Way-Stohastic-Traffic-Simulation/

# Four-Way Stochastic Traffic Simulation

A web-based simulation built for my IBDP Mathematics AI Higher Level Internal Assessment. It models traffic at a four-way intersection and compares a standard equal-time traffic light system against an optimised one that adapts based on queue lengths and arrival rates.

## What it does

The simulation generates random car arrivals using a Poisson process, which is a mathematical model for things that happen independently at a roughly constant average rate. The time between each arrival follows an exponential distribution.

Two traffic light systems run in parallel and their results are compared:

**Equal-time system** gives every approach road the same amount of green light per cycle, regardless of how many cars are waiting. This is the baseline.

**Optimised system** checks the queue at each road at the start of every cycle and redistributes the green time. Roads with more cars waiting get more time. The allocation minimises a weighted objective that balances average waiting time, peak queue length, and fairness across all four roads.

The Monte Carlo section repeats the simulation many times using different random seeds, then reports a mean, standard deviation, and 95% confidence interval for each metric. This makes the comparison between the two systems statistically meaningful rather than just a single lucky or unlucky run.

## Research question

Investigating how a stochastic queueing model can optimise green-light durations at a four-way intersection compared with an equal-time traffic light system.

## Features

- 3D isometric intersection built with Three.js and React Three Fiber
- Real-time animated cars that queue up, wait for green, and move through
- Adjustable arrival rates for each road (North, South, East, West)
- Two optimisation methods: Adaptive Queue-Weighted and Grid Search
- Monte Carlo runner with configurable trial count and 95% confidence intervals
- Results dashboard with percentage improvement calculations
- Charts for queue lengths over time, waiting time comparisons, green time allocation, and Monte Carlo distributions
- Exportable CSV data tables for use in the IA write-up
- Drag the divider between the 3D view and the results panel to resize
- Press Command+R (or Ctrl+R) to run the simulation quickly

## How to run it

You need Node.js installed.

```
npm install
npm run dev
```

Then open http://localhost:5173 in your browser.

## Tech stack

- React + Vite
- Three.js with React Three Fiber for the 3D scene
- Recharts for graphs
- Pure JavaScript simulation engine (no backend)

## Project context

This was built as the exploration tool for my Math AI HL Internal Assessment. The IA investigates whether stochastic queueing theory can justify a more intelligent traffic light system over a fixed-time one. All simulation logic, optimisation, and statistical analysis runs entirely in the browser.
