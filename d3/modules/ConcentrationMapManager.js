class ConcentrationMapManager {
    constructor(containerId) {
        this.containerId = containerId;
        this.svg = null;
        this.g = null;
        this.projection = null;
        this.path = null;
        this.zoom = null;
        this.tooltip = null;
        this.currentTransform = d3.zoomIdentity;
        this.geoData = null;
        this.stationsData = [];
        this.measurementsData = [];
        this.contaminanteSeleccionado = '';
        this.colorScale = null;
        this.radiusScale = null;
        this.legendBanner = null;
        this.bannerHeight = 175;

        // Nuevas variables para filtros
        this.activeStations = [];
        this.municipiosFiltrados = [];
        this.onTransformChange = null;
        this.isApplyingExternalTransform = false;
        this.viewWidth = 1;
        this.viewHeight = 1;
        this.contentWidth = 1;
        this.contentHeight = 1;
        this.offsetX = 0;
        this.offsetY = 0;
        this.projection = null;
    }

    init(geoData, stationsData, measurementsData) {
        this.geoData = geoData;
        this.stationsData = stationsData;
        this.measurementsData = measurementsData;

        this.setupSVG();
        this.setupTooltip();
        this.setupProjection();
        this.setupZoom();
        this.drawMap();
        this.setupControls();

        return this;
    }

    setupSVG() {
        this.svg = d3.select(this.containerId);
        const width = 563;
        const height = 935;

        // Limpiar SVG existente
        this.svg.selectAll('*').remove();

        // Crear grupo principal para el mapa (con zoom)
        this.g = this.svg.append('g');
        const mapHeight = height - this.bannerHeight - 10;
        this.viewWidth = width;
        this.viewHeight = height;
        this.contentWidth = width;
        this.contentHeight = mapHeight;
        this.offsetX = 0;
        this.offsetY = 0;

        // Crear banner inferior para leyendas
        this.setupLegendBanner();
    }

    setupLegendBanner() {
        const width = 563;
        const height = 935;

        // Posicionar el banner más arriba para que no se corte
        const bannerY = height - this.bannerHeight;

        // Crear grupo para el banner
        this.legendBanner = this.svg.append('g')
            .attr('class', 'legend-banner')
            .attr('transform', `translate(0, ${bannerY})`);

        // Fondo del banner SIN BORDE
        this.legendBanner.append('rect')
            .attr('width', width)
            .attr('height', this.bannerHeight)
            .attr('fill', '#DEDEDE');
        // Quitamos: .attr('stroke', '#000000') y .attr('stroke-width', 1)

        // Título del banner
        this.legendBanner.append('text')
            .attr('x', width / 2)
            .attr('y', 30)
            .attr('text-anchor', 'middle')
            .text('Leyenda de concentraciones')
            .style('font-family', 'Poppins, sans-serif')
            .style('font-size', '14px')
            .style('font-weight', '600')
            .style('fill', '#000000');

        // Grupos para las leyendas (izquierda y derecha)
        this.legendLeft = this.legendBanner.append('g')
            .attr('transform', 'translate(55, 46)');

        this.legendRight = this.legendBanner.append('g')
            .attr('transform', 'translate(325, 46)');
    }

    setupTooltip() {
        // Eliminar cualquier tooltip existente con este ID para evitar duplicados
        d3.select('#concentration-map-tooltip').remove();

        // Crear tooltip exactamente como en MapManager
        this.tooltip = d3.select('body').append('div')
            .attr('class', 'map-tooltip')
            .style('opacity', 0)
            .style('position', 'absolute')
            .style('background', 'rgba(0, 0, 0, 0.85)')
            .style('color', 'white')
            .style('padding', '12px')
            .style('border-radius', '6px')
            .style('border', '1px solid #333')
            .style('font-family', 'Poppins, sans-serif')
            .style('font-size', '12px')
            .style('pointer-events', 'none')
            .style('z-index', '1000')
            .style('box-shadow', '0 4px 8px rgba(0,0,0,0.3)')
            .style('max-width', '300px')
            .style('line-height', '1.4')
            .style('backdrop-filter', 'blur(2px)');
    }

    setupProjection() {
        if (!this.geoData) {
            console.error('No hay datos geoJSON para la proyección');
            return;
        }

        try {
            const width = 563;
            const height = 935;

            // Ajustar la altura del mapa para dejar espacio para el banner
            const mapHeight = height - this.bannerHeight - 10; // 10px de margen

            this.projection = d3.geoMercator()
                .fitSize([width, mapHeight], this.geoData);

            this.path = d3.geoPath().projection(this.projection);

        } catch (error) {
            console.error('Error configurando la proyección:', error);

            const width = 563;
            const height = 935;
            const mapHeight = height - this.bannerHeight - 10;

            this.projection = d3.geoMercator()
                .center([-74.0, 4.6])
                .scale(7500) // Ajustar escala para que quepa mejor
                .translate([width / 2, mapHeight / 2]);

            this.path = d3.geoPath().projection(this.projection);
        }
    }

    setupZoom() {
        this.zoom = d3.zoom()
            .scaleExtent([0.5, 20])
            .on('zoom', (event) => {
                this.currentTransform = event.transform;
                this.g.attr('transform', event.transform);
                if (!this.isApplyingExternalTransform && typeof this.onTransformChange === 'function') {
                    this.onTransformChange(event.transform);
                }
            });

        this.svg.call(this.zoom);
    }

    setTransformSyncHandler(handler) {
        this.onTransformChange = handler;
    }

    applyExternalTransform(transform) {
        if (!this.zoom || !this.svg || !transform) return;
        this.isApplyingExternalTransform = true;
        this.svg.call(this.zoom.transform, transform);
        this.isApplyingExternalTransform = false;
    }

    getViewDimensions() {
        return {
            fullWidth: this.viewWidth || 1,
            fullHeight: this.viewHeight || 1,
            contentWidth: this.contentWidth || this.viewWidth || 1,
            contentHeight: this.contentHeight || this.viewHeight || 1,
            offsetX: this.offsetX || 0,
            offsetY: this.offsetY || 0
        };
    }

    getProjection() {
        return this.projection;
    }

    drawMap() {
        if (!this.geoData || !this.geoData.features) {
            console.error('No hay datos geoJSON para dibujar');
            return;
        }

        // Dibujar municipios
        const municipios = this.g.selectAll('.municipio')
            .data(this.geoData.features);

        municipios.enter()
            .append('path')
            .attr('class', 'municipio')
            .attr('d', this.path)
            .style('fill', '#e9ecef')
            .style('stroke', '#adb5bd')
            .style('stroke-width', '0.5px')
            .style('cursor', 'pointer')
            .on('mouseover', (event, d) => {
                if (!this.tooltip) this.setupTooltip();
                
                this.tooltip
                    .style('opacity', 1)
                    .html(`
                        <div style="font-weight: bold; margin-bottom: 5px;">
                            ${d.properties.Departamento || 'N/A'}
                        </div>
                        <div>${d.properties.Municipio || 'N/A'}</div>
                    `);
            })
            .on('mouseout', () => {
                if (this.tooltip) {
                    this.tooltip.style('opacity', 0);
                }
            })
            .on('mousemove', (event) => {
                if (this.tooltip) {
                    this.tooltip
                        .style('left', (event.pageX + 15) + 'px')
                        .style('top', (event.pageY - 15) + 'px');
                }
            });
    }

    setupControls() {
        d3.select('#concentration-zoom-in').on('click', () => {
            this.svg.transition().duration(300).call(
                this.zoom.scaleBy, 1.5
            );
        });

        d3.select('#concentration-zoom-out').on('click', () => {
            this.svg.transition().duration(300).call(
                this.zoom.scaleBy, 0.75
            );
        });

        d3.select('#concentration-reset-view').on('click', () => {
            this.svg.transition().duration(300).call(
                this.zoom.transform, d3.zoomIdentity
            );
        });
    }

    calculateAverages(contaminante) {
        if (!this.measurementsData || this.measurementsData.length === 0) {
            console.warn('No hay datos de mediciones para calcular promedios');
            return [];
        }

        // Filtrar mediciones por contaminante
        const medicionesContaminante = this.measurementsData.filter(m =>
            m.variable === contaminante
        );

        if (medicionesContaminante.length === 0) {
            console.warn(`No hay mediciones para el contaminante: ${contaminante}`);
            return [];
        }

        // Agrupar por estación y calcular promedio
        const promediosPorEstacion = {};
        medicionesContaminante.forEach(medicion => {
            if (!promediosPorEstacion[medicion.station]) {
                promediosPorEstacion[medicion.station] = {
                    sum: 0,
                    count: 0,
                    unit: medicion.unit_measurement
                };
            }
            promediosPorEstacion[medicion.station].sum += medicion.value;
            promediosPorEstacion[medicion.station].count += 1;
        });

        // Convertir a array y calcular promedio final
        const promedios = Object.keys(promediosPorEstacion).map(stationId => {
            const data = promediosPorEstacion[stationId];
            return {
                station: stationId,
                average: data.sum / data.count,
                unit: data.unit,
                count: data.count
            };
        });

        console.log(`Promedios calculados para ${contaminante}:`, promedios);
        return promedios;
    }

    createScales(promedios) {
        if (!promedios || promedios.length === 0) {
            console.warn('No hay promedios para crear escalas');
            return;
        }

        const valores = promedios.map(d => d.average);

        // Calcular percentiles para categorías de color
        const percentiles = [0, 0.25, 0.5, 0.75, 1];
        const thresholds = percentiles.map(p => d3.quantile(valores, p));

        // Escala de colores (4 categorías)
        this.colorScale = d3.scaleThreshold()
            .domain(thresholds.slice(1, 4))
            .range(['#8FE200', '#FFEA00', '#FFA601', '#cb181d']);

        // Escala de radios (tamaño de círculos)
        const maxRadius = 12;
        const minRadius = 5;
        this.radiusScale = d3.scaleLinear()
            .domain([0, d3.max(valores)])
            .range([minRadius, maxRadius])
            .clamp(true);
    }

    drawCircles(promedios) {
        if (!promedios || promedios.length === 0) {
            console.warn('No hay promedios para dibujar círculos');

            // Mostrar mensaje cuando no hay datos debido a filtros
            if (this.activeStations && this.activeStations.length > 0) {
                this.showNoDataMessage('No hay datos para las estaciones seleccionadas con el contaminante actual');
            } else if (this.municipiosFiltrados && this.municipiosFiltrados.length > 0) {
                this.showNoDataMessage('No hay datos para los municipios seleccionados con el contaminante actual');
            }
            return;
        }

        // Limpiar círculos anteriores y mensajes
        this.g.selectAll('.concentration-circle').remove();
        this.g.selectAll('.no-data-message').remove();

        const circles = this.g.selectAll('.concentration-circle')
            .data(promedios, d => d.station);

        circles.enter()
            .append('circle')
            .attr('class', 'concentration-circle')
            .attr('r', d => this.radiusScale ? this.radiusScale(d.average) : 8)
            .attr('cx', d => {
                const station = this.stationsData.find(s => s.id === d.station);
                if (station && this.projection) {
                    const coords = this.projection([station.longitude, station.latitude]);
                    return coords ? coords[0] : 0;
                }
                return 0;
            })
            .attr('cy', d => {
                const station = this.stationsData.find(s => s.id === d.station);
                if (station && this.projection) {
                    const coords = this.projection([station.longitude, station.latitude]);
                    return coords ? coords[1] : 0;
                }
                return 0;
            })
            .attr('fill', d => this.colorScale ? this.colorScale(d.average) : '#fb6a4a')
            .attr('stroke', '#fff')
            .attr('stroke-width', 1.5)
            .attr('opacity', 0.8)
            .style('cursor', 'pointer')
            .on('mouseover', (event, d) => {
                if (!this.tooltip) this.setupTooltip();

                const station = this.stationsData.find(s => s.id === d.station);
                let infoFiltros = '';

                if (this.activeStations && this.activeStations.length > 0) {
                    infoFiltros = `<div style="margin-top: 5px; font-size: 10px; color: #ffd93d;">✓ Filtrada por selección de estaciones</div>`;
                }
                if (this.municipiosFiltrados && this.municipiosFiltrados.length > 0) {
                    infoFiltros += `<div style="margin-top: 2px; font-size: 10px; color: #ffd93d;">✓ Filtrada por selección de municipios</div>`;
                }

                this.tooltip
                    .style('opacity', 1)
                    .html(`
                    <div style="font-weight: bold; color: #4ecdc4; margin-bottom: 5px;">Estación ${d.station}</div>
                    <div>Concentración promedio de ${this.contaminanteSeleccionado}: ${d.average.toFixed(2)} ${d.unit}</div>
                    <div>Número de mediciones: ${d.count}</div>
                    ${station ? `<div>Latitud: ${station.latitude.toFixed(4)}</div><div>Longitud: ${station.longitude.toFixed(4)}</div>` : ''}
                    ${infoFiltros}
                `);
            })
            .on('mouseout', () => {
                if (this.tooltip) {
                    this.tooltip.style('opacity', 0);
                }
            })
            .on('mousemove', (event) => {
                if (this.tooltip) {
                    this.tooltip
                        .style('left', (event.pageX + 15) + 'px')
                        .style('top', (event.pageY - 15) + 'px');
                }
            });
    }

    // Método para mostrar mensaje cuando no hay datos
    showNoDataMessage(message) {
        this.g.selectAll('.no-data-message').remove();

        this.g.append('text')
            .attr('class', 'no-data-message')
            .attr('x', 563 / 2)
            .attr('y', 400)
            .attr('text-anchor', 'middle')
            .text(message)
            .style('font-family', 'Poppins, sans-serif')
            .style('font-size', '14px')
            .style('fill', '#666')
            .style('font-weight', '500');
    }

    drawLegend() {
        // Limpiar leyendas anteriores
        if (this.legendLeft) this.legendLeft.selectAll('*').remove();
        if (this.legendRight) this.legendRight.selectAll('*').remove();

        // Leyenda de colores (izquierda)
        this.drawColorLegend();

        // Leyenda de tamaños (derecha)
        this.drawSizeLegend();
    }

    drawColorLegend() {
        const colorLegend = this.legendLeft.append('g');

        // Título de leyenda de colores
        colorLegend.append('text')
            .attr('x', 0)
            .attr('y', 12)
            .text('Categorías por concentración')
            .style('font-family', 'Poppins, sans-serif')
            .style('font-size', '12px')
            .style('font-weight', '600')
            .style('fill', '#000000');

        if (!this.colorScale) return;

        const thresholds = this.colorScale.domain();
        const colors = this.colorScale.range();
        const labels = [
            `≤ ${thresholds[0].toFixed(2)}`,
            `${thresholds[0].toFixed(2)} - ${thresholds[1].toFixed(2)}`,
            `${thresholds[1].toFixed(2)} - ${thresholds[2].toFixed(2)}`,
            `> ${thresholds[2].toFixed(2)}`
        ];

        colors.forEach((color, i) => {
            const item = colorLegend.append('g')
                .attr('transform', `translate(0, ${24 + i * 22})`);

            // Cuadrado de color SIN BORDE
            item.append('rect')
                .attr('x', 0)
                .attr('y', 0)
                .attr('width', 14)
                .attr('height', 14)
                .attr('fill', color)
                .attr('stroke-width', 0.4)
                .attr('stroke', '#333');
            // Quitamos: .attr('stroke', '#333') y .attr('stroke-width', 0.5)

            // Etiqueta
            item.append('text')
                .attr('x', 25)
                .attr('y', 11)
                .text(labels[i])
                .style('font-family', 'Poppins, sans-serif')
                .style('font-size', '11px')
                .style('fill', '#000000')
                .style('font-weight', '400');
        });
    }

    drawSizeLegend() {
        const sizeLegend = this.legendRight.append('g');

        // Título de leyenda de tamaños
        sizeLegend.append('text')
            .attr('x', 0)
            .attr('y', 15)
            .text('Tamaño por concentración')
            .style('font-family', 'Poppins, sans-serif')
            .style('font-size', '12px')
            .style('font-weight', '600')
            .style('fill', '#000000');

        if (!this.radiusScale) return;

        const domain = this.radiusScale.domain();
        const sizes = [domain[0], domain[1] / 2, domain[1]];
        const labels = sizes.map(d => d.toFixed(2));

        sizes.forEach((size, i) => {
            const radius = this.radiusScale(size);
            const item = sizeLegend.append('g')
                .attr('transform', `translate(0, ${24 + i * 25})`);

            // Círculo de ejemplo SIN BORDE
            item.append('circle')
                .attr('cx', 15)
                .attr('cy', 10)
                .attr('r', radius)
                .attr('fill', '#fb6a4a')
                .attr('opacity', 0.8);
            // Quitamos: .attr('stroke', '#333') y .attr('stroke-width', 0.5)

            // Etiqueta
            item.append('text')
                .attr('x', 35)
                .attr('y', 13)
                .text(labels[i])
                .style('font-family', 'Poppins, sans-serif')
                .style('font-size', '11px')
                .style('fill', '#000000')
                .style('font-weight', '400');
        });
    }

    drawSizeLegend() {
    const sizeLegend = this.legendRight.append('g');

    // Título de leyenda de tamaños
    sizeLegend.append('text')
        .attr('x', 0)
        .attr('y', 12)
        .text('Tamaño por concentración')
        .style('font-family', 'Poppins, sans-serif')
        .style('font-size', '12px')
        .style('font-weight', '600')
        .style('fill', '#000000');

    if (!this.radiusScale) return;

    const domain  = this.radiusScale.domain();
    const sizes   = [domain[0], domain[1] / 2, domain[1]];
    const labels  = sizes.map(d => d.toFixed(2));

    const rowStartY = 22;  
    const rowGap = 30;   
    const offsetX = 0;  

    sizes.forEach((size, i) => {
        const radius = this.radiusScale(size);

        const item = sizeLegend.append('g')
            .attr('transform', `translate(${offsetX}, ${rowStartY + i * rowGap})`);

        // Círculo de ejemplo
        item.append('circle')
            .attr('cx', 10)
            .attr('cy', 10)
            .attr('r', radius)
            .attr('fill', '#b2b2b2ff')
            .attr('stroke', '#8a8a8aff')
            .attr('stroke-width', 0.4)
            .attr('opacity', 1);

        // Etiqueta (un poco más lejos del círculo)
        item.append('text')
            .attr('x', 40)   // más grande = más espacio horizontal
            .attr('y', 13)
            .text(labels[i])
            .style('font-family', 'Poppins, sans-serif')
            .style('font-size', '11px')
            .style('fill', '#000000')
            .style('font-weight', '400');
    });
}

    updateData(contaminante, activeStations = [], municipios = []) {
        console.log(`Actualizando mapa de concentración con contaminante: ${contaminante}, estaciones: ${activeStations}, municipios: ${municipios}`);

        this.contaminanteSeleccionado = contaminante;
        this.activeStations = activeStations;
        this.municipiosFiltrados = municipios;

        if (!this.tooltip) {
            this.setupTooltip();
        }

        const promedios = this.calculateAverages(contaminante);

        if (promedios && promedios.length > 0) {
            this.createScales(promedios);
            this.drawCircles(promedios);
            this.drawLegend();
        } else {
            this.g.selectAll('.concentration-circle').remove();
            if (this.legendLeft) this.legendLeft.selectAll('*').remove();
            if (this.legendRight) this.legendRight.selectAll('*').remove();
        }
    }

    // Filtrar estaciones por municipios
    filterStationsByMunicipio(stationsData, municipios) {
        if (!municipios || municipios.length === 0) {
            return stationsData;
        }

        // Aquí necesitaríamos una relación entre estaciones y municipios
        // Por ahora, vamos a asumir que las estaciones están en algún municipio
        // En una implementación real, necesitarías datos geoespaciales para esto

        console.log('Filtrando estaciones por municipios:', municipios);

        // Si no tenemos datos de ubicación específicos, mostramos todas las estaciones
        // En una implementación completa, aquí harías la intersección espacial
        return stationsData;
    }

    // Filtrar promedios por estaciones activas
    filterAveragesByStations(promedios, activeStations) {
        if (!activeStations || activeStations.length === 0) {
            return promedios;
        }

        return promedios.filter(promedio =>
            activeStations.includes(promedio.station)
        );
    }

    // Método actualizado calculateAverages con filtros
    calculateAverages(contaminante) {
        if (!this.measurementsData || this.measurementsData.length === 0) {
            console.warn('No hay datos de mediciones para calcular promedios');
            return [];
        }

        // Filtrar mediciones por contaminante
        let medicionesContaminante = this.measurementsData.filter(m =>
            m.variable === contaminante
        );

        // Filtrar por estaciones activas si hay alguna seleccionada
        if (this.activeStations && this.activeStations.length > 0) {
            medicionesContaminante = medicionesContaminante.filter(m =>
                this.activeStations.includes(m.station)
            );
        }

        if (medicionesContaminante.length === 0) {
            console.warn(`No hay mediciones para el contaminante: ${contaminante} en las estaciones seleccionadas`);
            return [];
        }

        // Agrupar por estación y calcular promedio
        const promediosPorEstacion = {};
        medicionesContaminante.forEach(medicion => {
            if (!promediosPorEstacion[medicion.station]) {
                promediosPorEstacion[medicion.station] = {
                    sum: 0,
                    count: 0,
                    unit: medicion.unit_measurement
                };
            }
            promediosPorEstacion[medicion.station].sum += medicion.value;
            promediosPorEstacion[medicion.station].count += 1;
        });

        // Convertir a array y calcular promedio final
        const promedios = Object.keys(promediosPorEstacion).map(stationId => {
            const data = promediosPorEstacion[stationId];
            return {
                station: stationId,
                average: data.sum / data.count,
                unit: data.unit,
                count: data.count
            };
        });

        console.log(`Promedios calculados para ${contaminante}:`, promedios);
        return promedios;
    }
}
