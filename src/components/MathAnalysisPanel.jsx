export default function MathAnalysisPanel() {
  return (
    <div className="math-panel">
      <h3 className="section-title">AI HL Mathematical Analysis</h3>

      <MathSection title="1. Poisson Arrival Process">
        <p>Vehicle arrivals are modelled as a <strong>Poisson process</strong> with rate λ (cars per second). The probability of exactly k arrivals in time interval t is:</p>
        <MathBlock>P(X = k) = e^(−λt) · (λt)^k / k!</MathBlock>
        <p>This model is appropriate because traffic arrivals are <em>memoryless</em> — past arrivals do not affect future ones — and vehicles arrive independently. The parameter λ represents the average arrival intensity for each approach road.</p>
      </MathSection>

      <MathSection title="2. Exponential Inter-Arrival Times">
        <p>The time between consecutive vehicle arrivals follows an <strong>Exponential distribution</strong>:</p>
        <MathBlock>T ~ Exponential(λ),  f(t) = λe^(−λt),  t ≥ 0</MathBlock>
        <p>This is generated via the inverse-CDF method: T = −ln(U)/λ, where U ~ Uniform(0,1). The exponential distribution is the continuous analogue of the Poisson process and is the unique memoryless continuous distribution.</p>
      </MathSection>

      <MathSection title="3. Queue Evolution Equation">
        <p>Each direction's queue evolves over discrete time steps Δt:</p>
        <MathBlock>Q_i(t + Δt) = max(0, Q_i(t) + A_i(t) − D_i(t))</MathBlock>
        <p>Where:</p>
        <ul>
          <li><strong>Q_i(t)</strong> — queue length at direction i at time t</li>
          <li><strong>A_i(t)</strong> — stochastic arrivals in [t, t+Δt): Poisson(λ_i · Δt)</li>
          <li><strong>D_i(t)</strong> — departures (only if direction i has green)</li>
        </ul>
        <MathBlock>D_i(t) = min(Q_i(t),  μ · Δt)  during green phase</MathBlock>
        <p>μ is the service rate (vehicles cleared per second). The max(0, ·) ensures non-negative queues.</p>
      </MathSection>

      <MathSection title="4. Why Equal-Time Systems Are Suboptimal">
        <p>An equal-time system allocates the same green duration g = (C − lost time) / 4 to all directions, ignoring variation in λ_i. When arrival rates are unbalanced, under-served roads accumulate long queues while over-served roads have idle green time.</p>
        <p>By Little's Law: L = λW, a road with λ_i = 0.3 receiving the same green as a road with λ_i = 0.05 will have six times the queue length, yet both receive identical service budgets.</p>
      </MathSection>

      <MathSection title="5. Optimisation Objective Function">
        <p>The optimised system minimises a weighted objective:</p>
        <MathBlock>J = α·W̄ + β·Q_max + γ·σ_W</MathBlock>
        <p>Where:</p>
        <ul>
          <li><strong>W̄</strong> — global mean waiting time across all vehicles</li>
          <li><strong>Q_max</strong> — maximum queue length observed during simulation</li>
          <li><strong>σ_W</strong> — standard deviation of mean waiting times across N, S, E, W (fairness penalty)</li>
        </ul>
        <p>Subject to constraints:</p>
        <MathBlock>g_N + g_S + g_E + g_W + L = C</MathBlock>
        <MathBlock>g_min ≤ g_i ≤ g_max  for all i ∈ {'{N,S,E,W}'}</MathBlock>
        <p>Where C is the cycle length and L = 4(t_yellow + t_red) is the total lost time per cycle.</p>
      </MathSection>

      <MathSection title="6. Adaptive Queue-Weighted Method">
        <p>At each cycle start, green time is allocated proportionally to queue pressure:</p>
        <MathBlock>w_i = Q_i + k · λ_i</MathBlock>
        <MathBlock>g_i = g_min + (w_i / Σw_j) · (C − L − 4·g_min)</MathBlock>
        <p>This dynamically responds to both current congestion (Q_i) and arrival rate (λ_i), preventing any direction from being starved while prioritising high-demand roads.</p>
      </MathSection>

      <MathSection title="7. Monte Carlo Simulation">
        <p>Because arrivals are stochastic, a single trial may not represent typical behaviour. Running n independent trials with different random seeds gives a distribution of outcomes:</p>
        <MathBlock>W̄₁, W̄₂, ..., W̄_n ~ simulation output</MathBlock>
        <p>The sample mean and standard deviation estimate the true expected performance:</p>
        <MathBlock>μ̂ = (1/n) Σ W̄_i,   SD = √[(1/(n−1)) Σ (W̄_i − μ̂)²]</MathBlock>
      </MathSection>

      <MathSection title="8. 95% Confidence Interval">
        <p>By the Central Limit Theorem, for sufficiently large n:</p>
        <MathBlock>CI₉₅ = μ̂ ± 1.96 · SD / √n</MathBlock>
        <p>This quantifies uncertainty in the estimated mean. Overlapping CIs between systems indicate the difference may not be statistically significant; non-overlapping CIs provide stronger evidence of genuine improvement.</p>
      </MathSection>

      <MathSection title="9. Percentage Improvement">
        <MathBlock>Improvement = ((W̄_equal − W̄_opt) / W̄_equal) × 100%</MathBlock>
        <p>Positive values indicate the optimised system reduces waiting time. Larger improvements are expected when arrival rates are highly imbalanced across directions.</p>
      </MathSection>

      <MathSection title="10. Model Assumptions & Limitations">
        <div className="assumption-grid">
          <div>
            <strong>Assumptions:</strong>
            <ul>
              <li>Arrivals follow a Poisson process (memoryless, independent)</li>
              <li>All vehicles are identical (no trucks/cyclists)</li>
              <li>Service rate μ is constant during green</li>
              <li>No turning movements modelled</li>
              <li>Queues have unlimited storage</li>
              <li>Driver reaction time absorbed into μ</li>
              <li>No pedestrian phases</li>
            </ul>
          </div>
          <div>
            <strong>Limitations:</strong>
            <ul>
              <li>Real traffic may exhibit time-dependent λ (rush hours)</li>
              <li>Correlated arrivals (platoons) violate Poisson independence</li>
              <li>Driver behaviour varies (aggressive/cautious)</li>
              <li>Lane changes and turning not modelled</li>
              <li>Physical vehicle acceleration simplified</li>
              <li>Emergency vehicles ignored</li>
            </ul>
          </div>
        </div>
      </MathSection>
    </div>
  );
}

function MathSection({ title, children }) {
  return (
    <div className="math-section">
      <div className="math-section-title">{title}</div>
      <div className="math-section-body">{children}</div>
    </div>
  );
}

function MathBlock({ children }) {
  return <div className="math-block"><code>{children}</code></div>;
}
