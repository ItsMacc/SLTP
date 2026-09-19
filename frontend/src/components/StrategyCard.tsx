import React, { useState, useRef } from 'react';
import { 
  Compass, 
  Activity, 
  Briefcase, 
  Repeat,
  CheckCircle2, 
  XCircle, 
  Sparkles,
  Zap,
  BookOpen,
  Scale,
  BarChart3
} from 'lucide-react';
import { type StrategyData, type DetailedPoint, type BacktestMetricData } from '../types/strategy';
import { GlossaryText } from './GlossaryText';
import Button from '../ui/Button';
import './StrategyCard.css';

interface StrategyCardProps {
  strategy: StrategyData;
  indexNumber?: number;
  actionButton?: React.ReactNode;
}

export const StrategyCard: React.FC<StrategyCardProps> = ({ 
  strategy, 
  indexNumber = 1, 
  actionButton 
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const toggleExpand = () => {
    if (isExpanded && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    setIsExpanded((prev) => !prev);
  };

  const renderDetailList = (items: (string | DetailedPoint)[], type: 'pro' | 'con' | 'neutral') => {
    return items.map((item, idx) => {
      const title = typeof item === 'string' ? item : item.title;
      const description = typeof item === 'string' ? undefined : item.description;

      return (
        <li key={idx} className={`detail-item detail-${type}`}>
          <div className="detail-bullet">
            {type === 'pro' && <CheckCircle2 className="icon-success" size={16} />}
            {type === 'con' && <XCircle className="icon-error" size={16} />}
            {type === 'neutral' && <span className="bullet-dot" />}
          </div>
          <div className="detail-text">
            <GlossaryText text={title} glossary={strategy.glossary} className="detail-title" />
            {description && (
              <p className="detail-desc">
                <GlossaryText text={description} glossary={strategy.glossary} />
              </p>
            )}
          </div>
        </li>
      );
    });
  };

  const renderMetricComparison = (
    label: string, 
    stratMetric: BacktestMetricData, 
    benchMetric: BacktestMetricData, 
    metricKey: keyof BacktestMetricData,
    isLowerBetter: boolean = false
  ) => {
    const stratVal = stratMetric[metricKey] as number;
    const benchVal = benchMetric[metricKey] as number;

    const isStratWinner = isLowerBetter ? stratVal < benchVal : stratVal > benchVal;
    const isBenchWinner = isLowerBetter ? benchVal < stratVal : benchVal > stratVal;

    return (
      <div className="comparison-metric-row">
        <span className="metric-title-col">{label}</span>
        <span className={`metric-val-col ${isStratWinner ? 'metric-winner' : ''}`}>
          {metricKey.includes('FinalValue') ? stratMetric.finalValue : 
           metricKey.includes('Cagr') ? stratMetric.cagr : 
           metricKey.includes('MaxDrawdown') ? stratMetric.maxDrawdown : stratMetric.sharpeRatio}
        </span>
        <span className={`metric-val-col ${isBenchWinner ? 'metric-winner' : ''}`}>
          {metricKey.includes('FinalValue') ? benchMetric.finalValue : 
           metricKey.includes('Cagr') ? benchMetric.cagr : 
           metricKey.includes('MaxDrawdown') ? benchMetric.maxDrawdown : benchMetric.sharpeRatio}
        </span>
      </div>
    );
  };

  return (
    <div ref={cardRef} className={`wireframe-card ${isExpanded ? 'is-expanded' : ''}`}>
      {/* 1. TOP HEADER BLOCK */}
      <div className="card-block-header">
        <div className="header-top-row">
          <div className="title-stack">
            <h2 className="wireframe-title">{strategy.name}</h2>
            <div className={`strategy-badge badge-${strategy.category.toLowerCase()}`}>
              <span className="badge-dot" />
              <span className="badge-text">{strategy.category} Strategy</span>
            </div>
          </div>
          <span className="wireframe-number">{indexNumber}</span>
        </div>
      </div>

      {/* 2. MIDDLE CONTENT BLOCK */}
      <div className="card-block-body">
        <p className="wireframe-summary">
          <GlossaryText text={strategy.summary} glossary={strategy.glossary} />
        </p>

        {/* 4-Metrics Bar */}
        <div className="metrics-row">
          <div className="metric-col">
            <span className="m-label"><Compass size={13} /> HORIZON</span>
            <span className="m-val">{strategy.metrics.horizon}</span>
          </div>
          <div className="metric-col">
            <span className="m-label"><Activity size={13} /> ACTIVITY</span>
            <span className="m-val">{strategy.metrics.activity}</span>
          </div>
          <div className="metric-col">
            <span className="m-label"><Briefcase size={13} /> POSITIONS</span>
            <span className="m-val">{strategy.metrics.positions}</span>
          </div>
          <div className="metric-col">
            <span className="m-label"><Repeat size={13} /> REBALANCE</span>
            <span className="m-val">{strategy.metrics.rebalance}</span>
          </div>
        </div>
      </div>

      {/* 3. PURE CSS GRID EXPANSION WRAPPER */}
      <div className="expandable-wrapper">
        <div className="expandable-inner">
          <div className="card-block-expanded">
            {/* IDEA & HYPOTHESIS */}
            <section className="section-block">
              <div className="section-header">
                <Sparkles size={16} className="section-icon" />
                <span>Idea & Hypothesis</span>
              </div>
              <div className="hypothesis-box">
                <GlossaryText text={strategy.idea.hypothesis} glossary={strategy.glossary} />
              </div>
              <div className="two-column-grid">
                <div className="column-box">
                  <span className="box-title">Why it works</span>
                  <ul className="detail-list">{renderDetailList(strategy.idea.whyItWorks, 'neutral')}</ul>
                </div>
                <div className="column-box">
                  <span className="box-title">Why it doesn't</span>
                  <ul className="detail-list">{renderDetailList(strategy.idea.whyItDoesnt, 'neutral')}</ul>
                </div>
              </div>
            </section>

            {/* EXECUTION MECHANICS */}
            <section className="section-block">
              <div className="section-header">
                <Zap size={16} className="section-icon" />
                <span>Execution Mechanics</span>
              </div>
              <div className="two-column-grid">
                <div className="logic-card">
                  <span className="logic-label">Universe Logic</span>
                  <p className="logic-body">
                    <GlossaryText text={strategy.universeLogic} glossary={strategy.glossary} />
                  </p>
                </div>
                <div className="logic-card">
                  <span className="logic-label">Rebalance Logic</span>
                  <p className="logic-body">
                    <GlossaryText text={strategy.rebalanceLogic} glossary={strategy.glossary} />
                  </p>
                </div>
              </div>
            </section>

            {/* IN-DEPTH ANALYSIS */}
            {strategy.inDepthSections && strategy.inDepthSections.length > 0 && (
              <section className="section-block">
                <div className="section-header">
                  <BookOpen size={16} className="section-icon" />
                  <span>In-Depth Analysis</span>
                </div>
                <div className="in-depth-container">
                  {strategy.inDepthSections.map((sec) => (
                    <div key={sec.id} className="deep-dive-card">
                      <span className="deep-dive-title">{sec.title}</span>
                      <div className="deep-dive-content">
                        {typeof sec.content === 'string' ? (
                          <GlossaryText text={sec.content} glossary={strategy.glossary} />
                        ) : (
                          sec.content
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* STRATEGY COMPARISON SECTION */}
            {strategy.comparisons && strategy.comparisons.length > 0 && (
              <section className="section-block">
                <div className="section-header">
                  <BarChart3 size={16} className="section-icon" />
                  <span>Strategy Comparison</span>
                </div>
                
                <div className="comparisons-container">
                  {strategy.comparisons.map((comp) => (
                    <div key={comp.id} className="comparison-period-card">
                      <div className="comparison-period-header">
                        <span className="comparison-period-title">{comp.periodName}</span>
                      </div>

                      <div className="comparison-qualitative-grid">
                        <div className="qualitative-box expectation-box">
                          <span className="qualitative-label">Expectation for this period</span>
                          <p className="qualitative-text">
                            <GlossaryText text={comp.expectation} glossary={strategy.glossary} />
                          </p>
                        </div>
                        <div className="qualitative-box result-box">
                          <span className="qualitative-label">Result &amp; Match Analysis</span>
                          <p className="qualitative-text">
                            <GlossaryText text={comp.resultSummary} glossary={strategy.glossary} />
                          </p>
                        </div>
                      </div>

                      <div className="comparison-svgs-row">
                        <div className="svg-chart-box">
                          <span className="svg-chart-label">{strategy.name}</span>
                          <div className="svg-container-wrapper">
                            {typeof comp.strategySvg === 'string' ? (
                              <img src={comp.strategySvg as string} alt={`${strategy.name} backtest chart`} className="backtest-svg-img" />
                            ) : (
                              comp.strategySvg
                            )}
                          </div>
                        </div>
                        <div className="svg-chart-box">
                          <span className="svg-chart-label">Buy and Hold (Benchmark)</span>
                          <div className="svg-container-wrapper">
                            {typeof comp.benchmarkSvg === 'string' ? (
                              <img src={comp.benchmarkSvg as string} alt="Benchmark backtest chart" className="backtest-svg-img" />
                            ) : (
                              comp.benchmarkSvg
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="comparison-metrics-table">
                        <div className="comparison-metric-header-row">
                          <span className="metric-title-col">Performance Metric</span>
                          <span className="metric-val-col">{strategy.name}</span>
                          <span className="metric-val-col">Buy &amp; Hold</span>
                        </div>
                        {renderMetricComparison('Final Portfolio Value', comp.metrics.strategy, comp.metrics.benchmark, 'rawFinalValue', false)}
                        {renderMetricComparison('CAGR', comp.metrics.strategy, comp.metrics.benchmark, 'rawCagr', false)}
                        {renderMetricComparison('Max Drawdown', comp.metrics.strategy, comp.metrics.benchmark, 'rawMaxDrawdown', false)}
                        {renderMetricComparison('Sharpe Ratio', comp.metrics.strategy, comp.metrics.benchmark, 'rawSharpe', false)}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* TRADE-OFF PROFILE */}
            <section className="section-block">
              <div className="section-header">
                <Scale size={16} className="section-icon" />
                <span>Trade-off Profile</span>
              </div>
              <div className="two-column-grid">
                <div className="pros-box">
                  <span className="pros-title">Pros</span>
                  <ul className="detail-list">{renderDetailList(strategy.pros, 'pro')}</ul>
                </div>
                <div className="cons-box">
                  <span className="cons-title">Cons</span>
                  <ul className="detail-list">{renderDetailList(strategy.cons, 'con')}</ul>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>

      {/* 4. FOOTER BLOCK */}
      <div className="card-block-footer">
        {actionButton ? (
          actionButton
        ) : (
          <Button 
            variant="outline" 
            size="md" 
            className="full-width-btn"
            onClick={toggleExpand}
          >
            <span>{isExpanded ? 'Collapse Strategy' : 'Explore Strategy'}</span>
          </Button>
        )}
      </div>
    </div>
  );
};