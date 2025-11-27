class VariablesChartManager {
    constructor(selector) {
        this.selector = selector;
        this.svg = d3.select(selector);
        this.margin = { top: 65, right: 150, bottom: 55, left: 70 };
        this.data = [];
        this.lastVariable = null;
        this.lastStations = [];
        this.selectedYear = '2024';
        this.monthLabels = ['Ene', 'Feb', 'Mar', 'Abr', 'May'];
        this.usesExternalColors = false;

        // Estados de interacción
        this.highlightedStation = null;
        this.inactiveStations = new Set();
        this.isHighlightMode = false;

        this.initChart();
        window.addEventListener('resize', () => this.handleResize());
    }

    initChart() {
        if (this.svg.empty()) {
            console.error('No se encontró el contenedor de la gráfica de variables');
            return;
        }

        const parent = this.svg.node().parentNode;
        this.tooltip = d3.select(parent).select('#variables-tooltip');
        this.messageBox = d3.select(parent).select('#variables-message');
        this.yearSelect = document.getElementById('variables-year-filter');
        if (this.yearSelect) {
            this.yearSelect.value = this.selectedYear;
            this.yearSelect.addEventListener('change', (event) => {
                this.selectedYear = event.target.value;
                if (this.lastVariable && this.lastStations?.length) {
                    this.updateData(this.lastVariable, this.lastStations);
                }
            });
        }

        this.svg.attr('preserveAspectRatio', 'xMidYMid meet');

        // Overlay para capturar clicks fuera de las líneas
        this.overlayGroup = this.svg.append('g')
            .attr('class', 'overlay-group')
            .style('pointer-events', 'all');

        this.chartGroup = this.svg.append('g');
        this.gridGroup = this.chartGroup.append('g').attr('class', 'grid-group');
        this.linesGroup = this.chartGroup.append('g').attr('class', 'lines-group');
        this.pointsGroup = this.chartGroup.append('g').attr('class', 'points-group');
        this.xAxisGroup = this.chartGroup.append('g').attr('class', 'x-axis axis');
        this.yAxisGroup = this.chartGroup.append('g').attr('class', 'y-axis axis');
        this.legendGroup = this.svg.append('g').attr('class', 'legend-group');

        this.xScale = d3.scaleLinear().domain([0, 4]);
        this.yScale = d3.scaleLinear();
        this.colorScale = d3.scaleOrdinal(
            d3.quantize(t => d3.interpolateGreys(0.25 + t * 0.55), 10).reverse()
        );

        this.updateDimensions();
    }

    updateDimensions() {
        if (!this.svg || this.svg.empty()) return;

        const parentBounds = this.svg.node().parentNode.getBoundingClientRect();
        const fullWidth = parentBounds.width;
        const fullHeight = parentBounds.height;

        this.width = Math.max(0, fullWidth - this.margin.left - this.margin.right);
        this.height = Math.max(0, fullHeight - this.margin.top - this.margin.bottom);

        this.svg
            .attr('viewBox', `0 0 ${fullWidth} ${fullHeight}`)
            .attr('width', fullWidth)
            .attr('height', fullHeight);

        this.chartGroup.attr('transform', `translate(${this.margin.left},${this.margin.top})`);
        this.xAxisGroup.attr('transform', `translate(0,${this.height})`);

        // Actualizar overlay
        this.overlayGroup.selectAll('*').remove();
        this.overlayGroup.append('rect')
            .attr('width', fullWidth)
            .attr('height', fullHeight)
            .attr('fill', 'transparent')
            .on('click', (event) => {
                this.resetHighlight();
            });

        this.xScale.range([0, this.width]);
        this.yScale.range([this.height, 0]);
    }

    resetHighlight() {
        this.highlightedStation = null;
        this.isHighlightMode = false;
        this.updateData(this.lastVariable, this.lastStations, true);
    }

    toggleStation(station) {
        if (this.inactiveStations.has(station)) {
            this.inactiveStations.delete(station);
        } else {
            this.inactiveStations.add(station);
        }
        this.updateData(this.lastVariable, this.lastStations, true);
    }

    handleLineClick(station) {
        this.highlightedStation = station;
        this.isHighlightMode = true;
        this.updateData(this.lastVariable, this.lastStations, true);
    }

    init(measurementsData, stationColorScale = null) {
        this.data = measurementsData || [];
        if (stationColorScale) {
            this.setExternalColorScale(stationColorScale);
        }
        this.renderMessage('Selecciona un contaminante, estaciones y periodo para ver la comparación.');
    }

    setExternalColorScale(stationColorScale) {
        if (!stationColorScale) return;
        const domain = stationColorScale.domain ? stationColorScale.domain() : [];
        const range = stationColorScale.range ? stationColorScale.range() : [];
        if (domain.length && range.length) {
            this.colorScale = d3.scaleOrdinal(range).domain(domain);
            this.usesExternalColors = true;
        }
    }

    handleResize() {
        this.updateDimensions();
        if (this.lastVariable && this.lastStations) {
            this.updateData(this.lastVariable, this.lastStations, true);
        }
    }

    updateData(variable, activeStations, skipDimensionUpdate = false) {
        if (!this.data || this.data.length === 0) return;

        this.lastVariable = variable;
        this.lastStations = activeStations;

        if (!skipDimensionUpdate) {
            this.updateDimensions();
        }

        if (!variable) {
            this.renderMessage('Selecciona un agente contaminante para visualizar los valores.');
            this.clearChart();
            return;
        }

        if (!activeStations || activeStations.length === 0) {
            this.renderMessage('Selecciona al menos una estación para comparar.');
            this.clearChart();
            return;
        }

        const filteredData = this.data.filter(d =>
            d.variable === variable &&
            activeStations.includes(d.station)
        );

        if (filteredData.length === 0) {
            this.renderMessage('No hay datos disponibles para la combinación seleccionada.');
            this.clearChart();
            return;
        }

        const dataForPeriod = this.filterByYear(filteredData);

        if (dataForPeriod.length === 0) {
            const label = this.selectedYear === 'average'
                ? 'promedio entre 2024 y 2025'
                : `el año ${this.selectedYear}`;
            this.renderMessage(`No hay datos disponibles para ${label}.`);
            this.clearChart();
            return;
        }

        const aggregated = this.aggregateByMonthAndStation(dataForPeriod);

        if (aggregated.length === 0) {
            this.renderMessage('No hay datos disponibles para la combinación seleccionada.');
            this.clearChart();
            return;
        }

        this.hideMessage();

        // Filtrar aggregated para excluir estaciones inactivas
        const filteredAggregated = aggregated.filter(series => 
            !this.inactiveStations.has(series.station)
        );

        const allValues = filteredAggregated.flatMap(series => series.values.map(v => v.value).filter(v => v !== null));

        this.yScale.domain([0, (d3.max(allValues) || 1) * 1.1]).nice();
        
        const aggregatedStations = aggregated.map(series => series.station);
        if (!this.usesExternalColors) {
            this.colorScale.domain(aggregatedStations);
        } else if (this.colorScale.domain) {
            const currentDomain = this.colorScale.domain();
            const missingStations = aggregatedStations.filter(st => !currentDomain.includes(st));
            if (missingStations.length > 0) {
                this.colorScale.domain([...currentDomain, ...missingStations]);
            }
        }

        const xAxis = d3.axisBottom(this.xScale)
            .tickValues(d3.range(0, 5))
            .tickFormat(d => this.monthLabels[d] || '');
        const yAxis = d3.axisLeft(this.yScale).ticks(6);

        this.xAxisGroup.call(xAxis);
        
        // Eje X
        this.xAxisLabel = this.xAxisLabel || this.chartGroup.append('text')
        .attr('class', 'x-axis-label')
        .attr('text-anchor', 'middle')
        .attr('font-size', 12)
        .attr('y', this.height + 35);
        
        this.xAxisLabel
        .attr('x', this.width / 2)
        .text('Mes');

        this.yAxisGroup.call(yAxis);

        // Eje Y
        this.yAxisLabel = this.yAxisLabel || this.chartGroup.append('text')
            .attr('class', 'y-axis-label')
            .attr('text-anchor', 'middle')
            .attr('font-size', 12)
            .attr('transform', `rotate(-90)`)
            .attr('x', -this.height / 2)
            .attr('y', -45);

        this.yAxisLabel
            .text('Unidad (' + (filteredData[0]?.unit_measurement || '') + ')');

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

        // Usar filteredAggregated para las líneas y puntos
        const lines = this.linesGroup.selectAll('.station-line')
            .data(filteredAggregated, d => d.station);

        const linesEnter = lines.enter()
            .append('path')
            .attr('class', 'station-line')
            .attr('fill', 'none')
            .attr('stroke-width', 2)
            .attr('stroke', d => this.colorScale(d.station))
            .attr('d', d => lineGenerator(d.values))
            .on('click', (event, d) => {
                event.stopPropagation();
                this.handleLineClick(d.station);
            });

        lines.merge(linesEnter)
            .transition()
            .duration(600)
            .attr('stroke', d => this.colorScale(d.station))
            .attr('stroke-width', d => {
                if (this.isHighlightMode) {
                    return d.station === this.highlightedStation ? 3 : 1;
                }
                return 2;
            })
            .attr('opacity', d => {
                if (this.isHighlightMode) {
                    return d.station === this.highlightedStation ? 1 : 0.3;
                }
                return 1;
            })
            .attr('d', d => lineGenerator(d.values));

        lines.exit().remove();

        const pointsData = filteredAggregated.flatMap(series =>
            series.values
                .filter(v => v.value !== null)
                .map(v => ({
                    station: series.station,
                    month: v.month,
                    value: v.value
                }))
        );

        const points = this.pointsGroup.selectAll('.station-point')
            .data(pointsData, d => `${d.station}-${d.month}`);

        const pointsEnter = points.enter()
            .append('circle')
            .attr('class', 'station-point')
            .attr('r', 3)
            .attr('fill', d => this.colorScale(d.station))
            .attr('cx', d => this.xScale(d.month))
            .attr('cy', d => this.yScale(d.value))
            .on('mouseenter', (event, d) => this.showTooltip(event, d, variable))
            .on('mousemove', (event, d) => this.moveTooltip(event))
            .on('mouseleave', () => this.hideTooltip())
            .on('click', (event, d) => {
                event.stopPropagation();
                this.handleLineClick(d.station);
            });

        points.merge(pointsEnter)
            .transition()
            .duration(600)
            .attr('cx', d => this.xScale(d.month))
            .attr('cy', d => this.yScale(d.value))
            .attr('fill', d => this.colorScale(d.station))
            .attr('r', d => {
                if (this.isHighlightMode) {
                    return d.station === this.highlightedStation ? 5 : 2;
                }
                return 3;
            })
            .attr('opacity', d => {
                if (this.isHighlightMode) {
                    return d.station === this.highlightedStation ? 1 : 0.3;
                }
                return 1;
            });

        points.exit().remove();

        // Renderizar leyenda con TODAS las estaciones que tienen datos (aggregated)
        this.renderLegend(aggregated);
    }

    renderLegend(series) {
        const itemHeight = 10;
        const spacing = 16;
        const totalLegendHeight = series.length > 0 ?
            ((series.length - 1) * spacing) + itemHeight :
            0;
        const offsetY = this.margin.top + Math.max(0, (this.height - totalLegendHeight) / 2);

        const legendItems = this.legendGroup
            .attr('transform', `translate(${this.margin.left + this.width + 25}, ${offsetY})`)
            .selectAll('.legend-item')
            .data(series, d => d.station);

        const legendEnter = legendItems.enter()
            .append('g')
            .attr('class', 'legend-item')
            .style('cursor', 'pointer')
            .on('click', (event, d) => {
                event.stopPropagation();
                this.toggleStation(d.station);
            });

        // CORRECCIÓN: Cuadro transparente para estaciones inactivas
        legendEnter.append('rect')
            .attr('width', 10)
            .attr('height', 10)
            .attr('rx', 3)
            .attr('ry', 3)
            .attr('fill', d => this.inactiveStations.has(d.station) ? 'transparent' : this.colorScale(d.station))
            // Añadir borde para estaciones inactivas para que sean visibles
            .attr('stroke', d => this.inactiveStations.has(d.station) ? '#999' : 'none')
            .attr('stroke-width', d => this.inactiveStations.has(d.station) ? 1 : 0);

        // CORRECCIÓN: Mejor alineación vertical del texto
        legendEnter.append('text')
            .attr('x', 16)
            .attr('y', 2.5) // Centrado verticalmente con el cuadro de 10px
            .attr('dy', '0.35em') // Ajuste fino para centrado vertical perfecto
            .text(d => `Estación ${d.station}`)
            .attr('font-family', 'Poppins, sans-serif')
            .attr('font-size', 11)
            .attr('fill', d => this.inactiveStations.has(d.station) ? '#999' : '#333');

        const merged = legendEnter.merge(legendItems);

        merged.select('rect')
            .attr('fill', d => this.inactiveStations.has(d.station) ? 'transparent' : this.colorScale(d.station))
            .attr('stroke', d => this.inactiveStations.has(d.station) ? '#999' : 'none')
            .attr('stroke-width', d => this.inactiveStations.has(d.station) ? 1 : 0);

        merged.select('text')
            .text(d => `Estación ${d.station}`)
            .attr('fill', d => this.inactiveStations.has(d.station) ? '#999' : '#333');

        merged.attr('transform', (_, i) => `translate(0, ${i * spacing})`);

        legendItems.exit().remove();
    }

    showTooltip(event, dataPoint, variable) {
        if (!this.tooltip || this.tooltip.empty()) return;

        const valueFormat = d3.format('.2f');
        const monthLabel = this.monthLabels[dataPoint.month] || '';
        const periodLabel = this.getPeriodLabel();

        this.tooltip
            .style('opacity', 1)
            .html(`
                <strong>Estación ${dataPoint.station}</strong><br>
                ${variable}: ${valueFormat(dataPoint.value)}<br>
                ${monthLabel} · ${periodLabel}
            `);

        this.moveTooltip(event);
    }

    moveTooltip(event) {
        if (!this.tooltip || this.tooltip.empty()) return;

        const parent = this.svg.node().parentNode;
        const bounds = parent.getBoundingClientRect();
        const tooltipWidth = this.tooltip.node().offsetWidth;
        const tooltipHeight = this.tooltip.node().offsetHeight;

        const x = event.clientX - bounds.left + 10;
        const y = event.clientY - bounds.top - tooltipHeight - 10;

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

    filterByYear(data) {
        if (this.selectedYear === 'average') {
            return data;
        }
        const year = parseInt(this.selectedYear, 10);
        return data.filter(d => d.date_time.getFullYear() === year);
    }

    aggregateByMonthAndStation(data) {
        if (!data || data.length === 0) return [];

        const yearMap = new Map();

        data.forEach(d => {
            const year = d.date_time.getFullYear();
            const station = d.station;
            const month = d.date_time.getMonth();
            if (!yearMap.has(year)) yearMap.set(year, new Map());
            const stationMap = yearMap.get(year);
            if (!stationMap.has(station)) stationMap.set(station, new Map());
            const monthMap = stationMap.get(station);
            if (!monthMap.has(month)) monthMap.set(month, []);
            monthMap.get(month).push(d.value);
        });

        const averageValues = map => {
            map.forEach((value, key) => {
                if (Array.isArray(value)) {
                    map.set(key, d3.mean(value));
                }
            });
        };

        yearMap.forEach(stationMap => {
            stationMap.forEach(monthMap => averageValues(monthMap));
        });

        let stationAggregation = new Map();
        if (this.selectedYear === 'average') {
            stationAggregation = new Map();
            yearMap.forEach(stationMap => {
                stationMap.forEach((months, station) => {
                    if (!stationAggregation.has(station)) {
                        stationAggregation.set(station, new Map());
                    }
                    const combinedMonths = stationAggregation.get(station);
                    months.forEach((value, month) => {
                        if (!combinedMonths.has(month)) combinedMonths.set(month, []);
                        combinedMonths.get(month).push(value);
                    });
                });
            });

            stationAggregation.forEach(months => {
                months.forEach((valueArray, month) => {
                    if (Array.isArray(valueArray)) {
                        months.set(month, d3.mean(valueArray));
                    }
                });
            });
        } else {
            const year = parseInt(this.selectedYear, 10);
            stationAggregation = yearMap.get(year) || new Map();
        }

        const monthsRange = d3.range(0, 5);
        const aggregated = [];

        stationAggregation.forEach((monthsMap, station) => {
            const values = monthsRange.map(month => ({
                month,
                value: monthsMap.has(month) ? monthsMap.get(month) : null
            }));

            const firstIndex = values.findIndex(v => v.value !== null);
            const lastIndex = (() => {
                for (let i = values.length - 1; i >= 0; i--) {
                    if (values[i].value !== null) return i;
                }
                return -1;
            })();

            if (firstIndex !== -1 && lastIndex !== -1 && lastIndex > firstIndex) {
                for (let i = firstIndex; i <= lastIndex; i++) {
                    if (values[i].value === null) {
                        values[i].value = 0;
                    }
                }
            }

            if (values.some(v => v.value !== null)) {
                aggregated.push({
                    station,
                    values
                });
            }
        });

        return aggregated;
    }

    getPeriodLabel() {
        return this.selectedYear === 'average'
            ? 'Promedio 2024-2025'
            : `Año ${this.selectedYear}`;
    }
}