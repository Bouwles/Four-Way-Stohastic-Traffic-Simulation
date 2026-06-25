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

## The math behind it

This section lists every piece of mathematics the simulation uses, in roughly the order it gets applied during a run.

### 1. Random car arrivals (Poisson process)

Cars arrive at each road at random, but with a steady long-run average rate. This is modelled with a Poisson process. If lambda is the average number of cars per second arriving at a road, then the probability of exactly k cars arriving in a time window of length t is:

```
P(X = k) = e^(-lambda*t) * (lambda*t)^k / k!
```

Each road (North, South, East, West) has its own lambda that you can change with the sliders.

### 2. Time between cars (exponential distribution)

A Poisson process has gaps between events that follow an exponential distribution. The probability density of waiting a time t for the next car is:

```
f(t) = lambda * e^(-lambda*t)
```

To turn a uniform random number U between 0 and 1 into one of these gaps, the simulation uses the inverse of the exponential's cumulative function:

```
T = -ln(1 - U) / lambda
```

The code keeps adding these gaps together to build the full list of arrival times for each road.

### 3. Reproducible randomness (seeded generator)

So that a run can be repeated exactly, the uniform random numbers come from a linear congruential generator (LCG) instead of the built-in random function:

```
s(n+1) = (1664525 * s(n) + 1013904223) mod 2^32
U = s(n+1) / 2^32
```

The same seed always gives the same sequence. Each of the four roads gets its own independent stream so they do not interfere.

### 4. How the queues change over time

Time is split into small steps of length dt. At every step, each road's queue updates with this rule:

```
Q_i(t + dt) = max(0, Q_i(t) + A_i(t) - D_i(t))
```

where:
- Q_i(t) is the number of cars waiting on road i
- A_i(t) is the number of new arrivals in that step
- D_i(t) is the number of cars that leave (depart) in that step

The max with 0 stops the queue from ever going negative.

### 5. How many cars can leave on green

A road only discharges cars while its light is green. The number that can leave per step depends on the saturation flow rate mu, the maximum cars per second a green light can push through:

```
D_i(t) = min(Q_i(t), mu * dt)   while green
D_i(t) = 0                       otherwise
```

Because mu*dt is usually not a whole number, the leftover fraction is handled with a weighted coin flip, so that on average the correct number of cars leaves over many steps.

### 6. Cycle length and lost time

One full cycle gives each of the four roads a green phase, then a yellow, then a short all-red for safety. The yellow and all-red time is wasted as far as moving cars goes, so it is called lost time:

```
lost time = 4 * (yellow + all-red)
usable green budget = cycle length - lost time
```

Every green-time plan, equal or optimised, has to share out this budget.

### 7. System A: equal-time lights (the baseline)

The simple system splits the budget evenly:

```
g_i = (cycle length - lost time) / 4   for every road
```

### 8. Performance measures

After a run, these numbers describe how well the lights did:

Mean waiting time per road, found by adding up queue length times step length over the whole run and dividing by the number of cars that arrived. This is the same idea as Little's law (total time waited divided by number of cars):

```
W_i = (sum of Q_i(t) * dt) / (cars arrived on road i)
```

Overall mean wait, the average across the four roads:

```
W_bar = (W_N + W_S + W_E + W_W) / 4
```

Fairness, measured as the standard deviation of the four roads' mean waits. A small value means every road is treated about equally:

```
sigma_W = sqrt( (1/4) * sum of (W_i - W_bar)^2 )
```

Max queue length is the longest any single queue ever got. Throughput is total cars served divided by the run time.

### 9. The objective being minimised

The optimised system tries to make one combined score as small as possible. It mixes three goals with weights you can adjust:

```
J = alpha * W_bar + beta * Q_max + gamma * sigma_W
```

- alpha weights average waiting time
- beta weights the worst-case queue length
- gamma weights fairness between roads

Lower J means a better, smoother, fairer intersection.

### 10. Optimisation method 1: grid search

This method tries many possible green-time splits and keeps the best one. It steps g_N, g_S, g_E through every value from the minimum green to the maximum green in fixed increments, and sets the fourth so the four add up to the budget:

```
g_W = budget - g_N - g_S - g_E
```

Any split where a value falls outside the allowed range is skipped. For each valid split it runs the simulation, computes J, and remembers the split with the lowest J. It is slow but thorough.

### 11. Optimisation method 2: adaptive queue-weighted (the main one)

This method does not fix the timings in advance. At the start of every cycle it looks at the live queues and the arrival rates, then shares out the green time in proportion to demand. Each road gets a weight:

```
weight_i = Q_i + k * lambda_i        (k = 2)
```

The queue term reacts to cars that are already waiting. The k * lambda term looks ahead, giving busier roads a head start before their queue even builds. The green times are then:

```
spare = budget - 4 * (minimum green)
g_i = (minimum green) + (weight_i / sum of weights) * spare
```

Each value is clamped to stay between the minimum and maximum green, and finally rescaled so the four still add up exactly to the budget:

```
g_i = (g_i / sum of g) * budget
```

Because this runs every cycle, the lights keep adjusting as traffic changes.

### 12. Repeating the experiment (Monte Carlo)

A single run could be lucky or unlucky, so the Monte Carlo section repeats the whole comparison n times, each with a different seed. For any measurement it then reports the sample mean and the sample standard deviation:

```
x_bar = (1/n) * sum of x_j
s = sqrt( (1/(n-1)) * sum of (x_j - x_bar)^2 )
```

### 13. 95% confidence interval

To show how trustworthy the averages are, each one comes with a 95% confidence interval:

```
x_bar  plus or minus  1.96 * s / sqrt(n)
```

If the equal-time and optimised intervals do not overlap, the difference between the systems is very likely real and not just chance.

### 14. Percentage improvement

The headline numbers compare the two systems as a percentage:

```
improvement = (baseline - optimised) / baseline * 100
```

For throughput, where higher is better, the sign is flipped so an increase still shows up as a positive improvement.

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
