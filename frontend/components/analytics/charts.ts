/**
 * The one seam between the analytics dashboard and Chart.js: registers the
 * controllers this page needs (tree-shaken bar + scatter), defines the shared
 * palette and duration/number formatters, and exposes a `chart` Knockout
 * binding that creates, updates (on observable change), and disposes the
 * Chart instance. Components never import Chart.js directly, so styling and
 * registration stay consistent in one place.
 */
import * as ko from 'knockout';
import {
    Chart, ChartConfiguration,
    BarController, BarElement,
    ScatterController, PointElement, LineElement,
    CategoryScale, LinearScale, Tooltip, Legend
} from 'chart.js';

Chart.register(BarController, BarElement, ScatterController, PointElement,
               LineElement, CategoryScale, LinearScale, Tooltip, Legend);

/** The shared palette: one primary series color, an accent for comparisons,
 * and a muted tone for reference/context marks. */
export const CHART_COLORS = {
    primary: "rgba(2, 117, 216, 0.7)",
    primarySolid: "rgb(2, 117, 216)",
    accent: "rgba(240, 173, 78, 0.8)",
    muted: "rgba(130, 130, 130, 0.5)"
};

/** "90" -> "1.5 min"; durations under two minutes stay in seconds. */
export function formatSeconds(seconds: number): string {
    if (seconds < 120) {
        return `${Math.round(seconds)} s`;
    }
    if (seconds < 5400) {
        return `${Math.round(seconds / 6) / 10} min`;
    }
    return `${Math.round(seconds / 360) / 10} h`;
}

export interface Bins {
    labels: string[];
    counts: number[];
}

/** Evenly-binned histogram data over raw values, with human-readable range
 * labels (formatted by `format`, e.g. seconds -> minutes). */
export function binValues(values: number[], binCount: number,
                          format: (value: number) => string = String): Bins {
    if (!values.length) {
        return {labels: [], counts: []};
    }
    const max = Math.max(...values);
    const min = Math.min(...values);
    const width = (max - min) / binCount || 1;
    const labels: string[] = [];
    const counts: number[] = [];
    for (let bin = 0; bin < binCount; bin += 1) {
        const low = min + bin * width;
        labels.push(`${format(low)}–${format(low + width)}`);
        counts.push(0);
    }
    values.forEach((value) => {
        const bin = Math.min(binCount - 1, Math.floor((value - min) / width));
        counts[bin] += 1;
    });
    return {labels, counts};
}

/** A standard histogram config over pre-binned data. */
export function histogramConfig(bins: Bins, label: string): ChartConfiguration {
    return {
        type: "bar",
        data: {
            labels: bins.labels,
            datasets: [{label, data: bins.counts, backgroundColor: CHART_COLORS.primary}]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {legend: {display: false}, tooltip: {enabled: true}},
            scales: {
                x: {title: {display: true, text: label}},
                y: {title: {display: true, text: "Students"}, ticks: {precision: 0}}
            }
        }
    };
}

export interface ScatterPoint {
    x: number;
    y: number;
    label: string;
}

/** A standard scatter config; each point carries a label for its tooltip. */
export function scatterConfig(points: ScatterPoint[], xLabel: string,
                              yLabel: string): ChartConfiguration {
    return {
        type: "scatter",
        data: {
            datasets: [{
                data: points,
                backgroundColor: CHART_COLORS.primary,
                pointRadius: 5,
                pointHoverRadius: 7
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {display: false},
                tooltip: {
                    callbacks: {
                        label: (context: any) => {
                            const point = context.raw as ScatterPoint;
                            return `${point.label}: ${xLabel} ${Math.round(point.x * 10) / 10}, `
                                + `${yLabel} ${Math.round(point.y * 10) / 10}`;
                        }
                    }
                }
            },
            scales: {
                x: {title: {display: true, text: xLabel}},
                y: {title: {display: true, text: yLabel}}
            }
        }
    };
}

/**
 * `data-bind="chart: someObservableConfig"` on a <canvas>: builds the Chart
 * when a config appears, rebuilds it when the observable changes, and
 * disposes it with the element. A null/undefined config clears the chart.
 */
ko.bindingHandlers["chart"] = {
    init: (element: HTMLCanvasElement, valueAccessor: () => any) => {
        let chart: Chart | null = null;
        const watcher = ko.computed(() => {
            const config = ko.unwrap(valueAccessor());
            if (chart != null) {
                chart.destroy();
                chart = null;
            }
            if (config != null) {
                chart = new Chart(element, config);
            }
        });
        ko.utils.domNodeDisposal.addDisposeCallback(element, () => {
            watcher.dispose();
            if (chart != null) {
                chart.destroy();
                chart = null;
            }
        });
        return {controlsDescendantBindings: false};
    }
};
