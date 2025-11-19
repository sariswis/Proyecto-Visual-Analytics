class ComparisonChartManager {
    constructor(selector) {
        this.selector = selector;
        this.svg = d3.select(selector);
        this.margin = { top: 40, right: 130, bottom: 45, left: 65 };
        this.monthLabels = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo'];
        this.colors = {
            '2024': '#17bfcf',
            '2025': '#1e77b4'
        };
        this.visibleMonths = this.monthLabels.length;

        this.data = [];
        this.currentVariable = 'PM2.5';

        this.initChart();
        window.addEventListener('resize', () => this.handleResize());
    }

    initChart() {
        if (this.svg.empty()) {
            console.error('No se encontró el contenedor de comparación');
            return;
        }

        const parent = this.svg.node().parentNode;
        this.tooltip = d3.select(parent).select('#comparison-tooltip');
        this.messageBox = d3.select(parent).select('#comparison-message');

        this.chartGroup = this.svg.append('g');
        this.gridGroup = this.chartGroup.append('g').attr('class', 'grid-group');
        this.linesGroup = this.chartGroup.append('g').attr('class', 'lines-group');
        this.pointsGroup = this.chartGroup.append('g').attr('class', 'points-group');
        this.xAxisGroup = this.chartGroup.append('g').attr('class', 'x-axis axis');
        this.yAxisGroup = this.chartGroup.append('g').attr('class', 'y-axis axis');
        this.legendGroup = this.svg.append('g').attr('class', 'comparison-legend');

        this.xScale = d3.scaleLinear().domain([0, this.visibleMonths - 1]);
        this.yScale = d3.scaleLinear();

        this.updateDimensions();
    }

    updateDimensions() {
        if (this.svg.empty()) return;

        const bounds = this.svg.node().parentNode.getBoundingClientRect();
        const fullWidth = bounds.width;
        const fullHeight = bounds.height;

        this.width = Math.max(0, fullWidth - this.margin.left - this.margin.right);
        this.height = Math.max(0, fullHeight - this.margin.top - this.margin.bottom);

        this.svg
            .attr('viewBox', `0 0 ${fullWidth} ${fullHeight}`)
            .attr('width', fullWidth)
            .attr('height', fullHeight);

        this.chartGroup.attr('transform', `translate(${this.margin.left}, ${this.margin.top})`);
        this.xAxisGroup.attr('transform', `translate(0, ${this.height})`);

        this.xScale.range([0, this.width]);
        this.yScale.range([this.height, 0]);
    }

    init(measurementsData) {
        this.data = measurementsData || [];
        if (!this.data.length) {
            this.renderMessage('No hay datos de mediciones disponibles.');
        }
    }

    handleResize() {
        this.updateDimensions();
        if (this.data.length > 0) {
            this.render(this.currentVariable);
        }
    }

    updateData(variable, activeStations) {
        this.currentVariable = variable || this.currentVariable;
        this.render(this.currentVariable, activeStations);
    }

    render(variable) {
        if (!this.data || !this.data.length) {
            this.renderMessage('No hay datos disponibles.');
            return;
        }

        if (!variable) {
            this.renderMessage('Selecciona un agente contaminante para visualizar la comparación.');
            this.clearChart();
            return;
        }

        this.hideMessage();

        const filtered = this.data.filter(d => d.variable === variable);
        if (!filtered.length) {
            this.renderMessage('No hay mediciones para el contaminante seleccionado.');
            this.clearChart();
            return;
        }

        const aggregated = this.aggregateByYearAndMonth(filtered);
        if (!aggregated.length) {
            this.renderMessage('No hay datos agregados disponibles.');
            this.clearChart();
            return;
        }

        const allValues = aggregated.flatMap(series => series.values.map(v => v.value));
        this.yScale.domain([0, (d3.max(allValues) || 1) * 1.1]).nice();

        const monthsRange = d3.range(0, this.visibleMonths);

        const xAxis = d3.axisBottom(this.xScale)
            .tickValues(monthsRange)
            .tickFormat(d => this.monthLabels[d] || '');
        const yAxis = d3.axisLeft(this.yScale).ticks(6);

        this.xAxisGroup.call(xAxis);
        this.yAxisGroup.call(yAxis);

        const grid = this.gridGroup.selectAll('.grid-line')
            .data(this.yScale.ticks(6));

        grid.enter()
            .append('line')
            .attr('class', 'grid-line')
            .merge(grid)
            .attr('x1', 0)
            .attr('x2', this.width)
            .attr('y1', d => this.yScale(d))
            .attr('y2', d => this.yScale(d));

        grid.exit().remove();

        const lineGenerator = d3.line()
            .defined(d => d.value !== null)
            .x(d => this.xScale(d.month))
            .y(d => this.yScale(d.value))
            .curve(d3.curveMonotoneX);

        const lines = this.linesGroup.selectAll('.comparison-line')
            .data(aggregated, d => d.year);

        lines.enter()
            .append('path')
            .attr('class', 'comparison-line')
            .attr('stroke', d => this.colors[d.year] || '#999')
            .attr('d', d => lineGenerator(d.values))
            .merge(lines)
            .transition()
            .duration(600)
            .attr('stroke', d => this.colors[d.year] || '#999')
            .attr('d', d => lineGenerator(d.values));

        lines.exit().remove();

        const pointsData = aggregated.flatMap(series =>
            series.values
                .filter(v => v.value !== null)
                .map(v => ({
                    year: series.year,
                    month: v.month,
                    value: v.value
                }))
        );

        const points = this.pointsGroup.selectAll('.comparison-point')
            .data(pointsData, d => `${d.year}-${d.month}`);

        points.enter()
            .append('circle')
            .attr('class', 'comparison-point')
            .attr('r', 3)
            .attr('fill', d => this.colors[d.year] || '#999')
            .attr('cx', d => this.xScale(d.month))
            .attr('cy', d => this.yScale(d.value))
            .on('mouseenter', (event, d) => this.showTooltip(event, d, variable))
            .on('mousemove', event => this.moveTooltip(event))
            .on('mouseleave', () => this.hideTooltip())
            .merge(points)
            .transition()
            .duration(600)
            .attr('cx', d => this.xScale(d.month))
            .attr('cy', d => this.yScale(d.value))
            .attr('fill', d => this.colors[d.year] || '#999');

        points.exit().remove();

        this.renderLegend();
    }

    aggregateByYearAndMonth(data) {
        const grouped = d3.rollups(
            data,
            entries => d3.rollups(
                entries,
                values => d3.mean(values, d => d.value),
                d => d.date_time.getMonth()
            ).map(([month, value]) => ({ month, value })),
            d => d.date_time.getFullYear()
        );

        const years = ['2024', '2025'];
        return years.map(year => {
            const yearData = grouped.find(([y]) => String(y) === year);
            const monthValues = d3.range(0, this.visibleMonths).map(month => ({
                month,
                value: null
            }));
            if (yearData) {
                yearData[1].forEach(({ month, value }) => {
                    if (month < this.visibleMonths) {
                        monthValues[month].value = value;
                    }
                });
            }

            return { year, values: monthValues };
        });
    }

    renderLegend() {
        const legendData = ['2024', '2025'];
        const spacing = 28;
        const itemHeight = 14;
        const totalHeight = ((legendData.length - 1) * spacing) + itemHeight;
        const startY = this.margin.top + Math.max(0, (this.height - totalHeight) / 2);
        const startX = this.margin.left + this.width + 20;

        const legendItems = this.legendGroup
            .attr('transform', `translate(${startX}, ${startY})`)
            .selectAll('.legend-item')
            .data(legendData);

        const legendEnter = legendItems.enter()
            .append('g')
            .attr('class', 'legend-item');

        legendEnter.append('rect')
            .attr('width', 14)
            .attr('height', 14)
            .attr('rx', 2)
            .attr('ry', 2)
            .attr('fill', d => this.colors[d] || '#999');

        legendEnter.append('text')
            .attr('x', 22)
            .attr('y', 11)
            .text(d => d)
            .attr('font-family', 'Poppins, sans-serif')
            .attr('font-size', 12)
            .attr('fill', '#333');

        const merged = legendEnter.merge(legendItems);

        merged
            .attr('transform', (_, i) => `translate(0, ${i * spacing})`);

        merged.select('rect')
            .attr('fill', d => this.colors[d] || '#999');

        merged.select('text').text(d => d);

        legendItems.exit().remove();
    }

    showTooltip(event, dataPoint, variable) {
        if (!this.tooltip || this.tooltip.empty()) return;

        const formatValue = d3.format('.2f');

        this.tooltip
            .style('opacity', 1)
            .html(`
                <strong>${variable}</strong><br>
                Año ${dataPoint.year}<br>
                Mes: ${this.monthLabels[dataPoint.month]}<br>
                Promedio: ${formatValue(dataPoint.value)}
            `);

        this.moveTooltip(event);
    }

    moveTooltip(event) {
        if (!this.tooltip || this.tooltip.empty()) return;

        const parent = this.svg.node().parentNode;
        const bounds = parent.getBoundingClientRect();
        const tooltipWidth = this.tooltip.node().offsetWidth || 0;
        const tooltipHeight = this.tooltip.node().offsetHeight || 0;

        const x = event.clientX - bounds.left + 12;
        const y = event.clientY - bounds.top - tooltipHeight - 12;

        this.tooltip
            .style('left', `${Math.min(x, bounds.width - tooltipWidth - 5)}px`)
            .style('top', `${Math.max(y, 5)}px`);
    }

    hideTooltip() {
        if (!this.tooltip || this.tooltip.empty()) return;
        this.tooltip.style('opacity', 0);
    }

    renderMessage(text) {
        if (!this.messageBox || this.messageBox.empty()) return;
        this.messageBox.text(text).style('opacity', 1);
    }

    hideMessage() {
        if (this.messageBox && !this.messageBox.empty()) {
            this.messageBox.text('').style('opacity', 0);
        }
    }

    clearChart() {
        this.linesGroup.selectAll('*').remove();
        this.pointsGroup.selectAll('*').remove();
        this.legendGroup.selectAll('*').remove();
        this.xAxisGroup.selectAll('*').remove();
        this.yAxisGroup.selectAll('*').remove();
        this.gridGroup.selectAll('*').remove();
    }
}
