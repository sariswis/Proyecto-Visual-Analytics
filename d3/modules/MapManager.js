class MapManager {
    constructor(containerId) {
        this.containerId = containerId;
        this.svg = null;
        this.g = null;
        this.projection = null;
        this.path = null;
        this.zoom = null;
        this.tooltip = null;
        this.currentTransform = d3.zoomIdentity;
        this.stationColorScale = null;
        this.activeStations = [];
        this.geoData = null;
        this.geoDataDepartamentos = null;
        this.geoDataVias = null;
        this.showRoads = false;
        this.fuentesData = [];
        this.stationsData = [];
        this.stationsPermitsMatrix = [];
        this.variablesOfStation = {};
        this.contaminanteSeleccionado = '';
        this.onTransformChange = null;
        this.isApplyingExternalTransform = false;
        this.viewWidth = 1;
        this.viewHeight = 1;
        this.contentWidth = 1;
        this.contentHeight = 1;
        this.offsetX = 0;
        this.offsetY = 0;
        this.projection = null;
        this.incidenciaRadiusScale = null;
        this.legendBanner = null;
        this.bannerHeight = 75;
    }

    init(geoData, geoDataDepartamentos, geoDataVias, fuentesData, stationsData, stationsPermitsMatrix, variablesOfStation) {
        this.geoData = geoData;
        this.geoDataDepartamentos = geoDataDepartamentos;
        this.geoDataVias = geoDataVias;
        this.fuentesData = fuentesData;
        this.stationsData = stationsData;
        this.stationsPermitsMatrix = stationsPermitsMatrix;
        this.variablesOfStation = variablesOfStation;

        this.setupColorScales();
        this.setupSVG();
        this.setupTooltip();
        this.setupProjection();
        this.setupZoom();
        this.drawMap();
        this.setupControls();

        return this;
    }

    setupColorScales() {
        if (this.stationsData && this.stationsData.length > 0) {
            const combinedColors = [
                ...d3.schemeCategory10,
                ...d3.schemeDark2,
                ...d3.schemePaired,
            ];

            const uniqueColors = [...new Set(combinedColors)].slice(0, 25);

            this.stationColorScale = d3.scaleOrdinal(uniqueColors)
                .domain(this.stationsData.map(d => d.id));
        } else {
            const combinedColors = [
                ...d3.schemeCategory10,
                ...d3.schemeDark2,
                ...d3.schemePaired,
            ];
            const uniqueColors = [...new Set(combinedColors)].slice(0, 25);

            this.stationColorScale = d3.scaleOrdinal(uniqueColors)
                .domain(['1', '2', '3', '4', '5']);
        }
    }

    getStationColorScale() {
        return this.stationColorScale;
    }

    setupSVG() {
        this.svg = d3.select(this.containerId);
        const width = 735;
        const height = 350;

        this.svg
            .attr('width', width)
            .attr('height', height)
            .style('background-color', '#f8f9fa')
            .style('border', '1px solid #ddd')
            .style('border-radius', '4px');

        this.svg.selectAll('*').remove();
        this.g = this.svg.append('g');
        this.viewWidth = width;
        this.viewHeight = height;
        this.contentWidth = width;
        this.contentHeight = height;
        this.offsetX = 0;
        this.offsetY = 0;

        this.setupLegendBanner();
    }

    setupLegendBanner() {
        const width = 735;
        const height = 385;

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

        // Grupos para las leyendas (izquierda y derecha)
        this.legendLeft = this.legendBanner.append('g')
            .attr('transform', 'translate(10, 10)');

        this.legendRight = this.legendBanner.append('g')
            .attr('transform', 'translate(150, 10)');
    }

    setupTooltip() {
        d3.select('.map-tooltip').remove();

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
            const width = 735;
            const height = 385;

            this.projection = d3.geoMercator()
                .fitSize([width, height], this.geoData);

            this.path = d3.geoPath().projection(this.projection);

        } catch (error) {
            console.error('Error configurando la proyección:', error);

            this.projection = d3.geoMercator()
                .center([-74.0, 4.6])
                .scale(8000)
                .translate([735 / 2, 385 / 2]);

            this.path = d3.geoPath().projection(this.projection);
        }
    }

    setupZoom() {
        this.zoom = d3.zoom()
            .scaleExtent([0.8, 150])
            .on('zoom', (event) => {
                this.currentTransform = event.transform;
                this.g.attr('transform', event.transform);
                
                // Escalar inversamente las marcas
                this.scaleMarkers(event.transform.k);
                
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
        if (!this.geoData || !this.geoData.features || !this.geoDataDepartamentos || !this.geoDataDepartamentos.features) {
            console.error('No hay datos geoJSON para dibujar');
            return;
        }

        // Dibujar departamentos
        const departamentos = this.g.selectAll('.departamento')
            .data(this.geoDataDepartamentos.features);

        departamentos.enter()
            .append('path')
            .attr('class', 'departamento')
            .attr('d', this.path)
            .style('fill', '#e9ecef')
            .style('stroke', '#adb5bd')
            .style('stroke-width', '2px')

        // Dibujar municipios
        const municipios = this.g.selectAll('.municipio')
            .data(this.geoData.features);

        municipios.enter()
            .append('path')
            .attr('class', 'municipio')
            .attr('d', this.path)
            .style('fill', '#ffffff00')
            .style('stroke', '#adb5bd')
            .style('stroke-width', '0.5px').style('cursor', 'pointer')
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

        // Dibujar vías
        const vias = this.g.selectAll('.via')
            .data(this.geoDataVias.features);
            
        vias.enter()
            .append('path')
            .attr('class', 'via')
            .attr('d', this.path)
            .style('fill', '#ffffff00')
            .style('stroke', '#f38f2d')
            .style('stroke-width', '0.2px')
            .style('cursor', 'pointer')
            .style('opacity', 0);

        // Dibujar estaciones
        this.drawStations();

        // Dibujar fuentes
        this.drawFuentes();
    }

    handleRoadMouseOver(event, d) {
        if (!this.tooltip) this.setupTooltip();
                
        this.tooltip
            .style('opacity', 1)
            .html(`
                <div style="font-weight: bold; margin-bottom: 5px;">
                    ${d.properties.Tipo || 'N/A'}
                </div>
                <div>${d.properties.Nombre || 'N/A'}</div>
            `);
    }

    handleRoadMouseOut(event, d) {
        if (this.tooltip) {
            this.tooltip.style('opacity', 0);
        }
    }

    handleRoadMouseMove(event, d) {
        if (this.tooltip) {
            this.tooltip
                .style('left', (event.pageX + 15) + 'px')
                .style('top', (event.pageY - 15) + 'px');
        }
    }

    drawStations() {
        if (!this.stationsData || this.stationsData.length === 0) {
            console.warn('No hay datos de estaciones para dibujar');
            return;
        }

        const estacionesActivas = this.stationsData.filter(station =>
            this.activeStations.includes(station.id) &&
            !isNaN(station.latitude) && !isNaN(station.longitude)
        );

        console.log(`Dibujando ${estacionesActivas.length} estaciones activas`);

        this.g.selectAll('.estacion-punto').remove();

        const triangleSymbol = d3.symbol().type(d3.symbolTriangle).size(70); // Tamaño base

        const estaciones = this.g.selectAll('.estacion-punto')
            .data(estacionesActivas, d => d.id);

        estaciones.enter()
            .append('path')
            .attr('class', 'estacion-punto')
            .attr('d', triangleSymbol)
            .attr('transform', d => {
                const coords = this.projection([d.longitude, d.latitude]);
                if (!coords) return 'translate(0,0)';
                return `translate(${coords[0]}, ${coords[1]}) scale(${1 / Math.sqrt(this.currentTransform.k)})`;
            })
            .attr('fill', d => this.stationColorScale(d.id))
            .attr('stroke', '#fff')
            .attr('stroke-width', 0.6)
            .style('cursor', 'pointer')
            .on('mouseover', (event, d) => {
                d3.select(event.target).attr('stroke-width', 0.8);
                this.showTooltip(event, d, 'estacion');
            })
            .on('mouseout', (event, d) => {
                d3.select(event.target).attr('stroke-width', 0.6);
                this.hideTooltip();
            })
            .on('mousemove', (event) => this.moveTooltip(event));
    }

    drawFuentes() {
        if (!this.fuentesData || this.fuentesData.length === 0) {
            console.warn('No hay datos de fuentes para dibujar');
            return;
        }

        // Calcular incidencia promedio
        const promediosIncidencia = this.calculateAverageIncidencia();
        
        if (promediosIncidencia.length === 0) {
            console.warn('No hay datos de incidencia para mostrar');
            this.g.selectAll('.fuente-circle').remove();
            return;
        }

        // Crear escalas
        this.createIncidenciaScales(promediosIncidencia);

        // Crear mapa de incidencias para acceso rápido
        const incidenciaMap = {};
        promediosIncidencia.forEach(p => {
            incidenciaMap[p.fuenteId] = p;
        });

        // Filtrar fuentes que tienen incidencia calculada
        const fuentesConIncidencia = this.fuentesData.filter(fuente => 
            incidenciaMap[fuente.ID] && !isNaN(fuente.Latitud) && !isNaN(fuente.Longitud)
        );

        console.log(`Mostrando ${fuentesConIncidencia.length} fuentes con incidencia`);

        // Limpiar fuentes anteriores
        this.g.selectAll('.fuente-circle').remove();

        // Dibujar círculos
        const circles = this.g.selectAll('.fuente-circle')
            .data(fuentesConIncidencia, d => d.ID);

        circles.enter()
            .append('circle')
            .attr('class', 'fuente-circle')
            .attr('cx', d => {
                const coords = this.projection([d.Longitud, d.Latitud]);
                return coords ? coords[0] : 0;
            })
            .attr('cy', d => {
                const coords = this.projection([d.Longitud, d.Latitud]);
                return coords ? coords[1] : 0;
            })
            .attr('r', d => {
                const incidencia = incidenciaMap[d.ID];
                const baseRadius = this.incidenciaRadiusScale(incidencia.averageIncidencia);
                return baseRadius / this.currentTransform.k;
            })
            .attr('data-base-radius', d => {
                const incidencia = incidenciaMap[d.ID];
                return this.incidenciaRadiusScale(incidencia.averageIncidencia);
            })
            .attr('fill', '#ff7f0f')
            .attr('stroke', '#fff')
            .attr('vector-effect', 'non-scaling-stroke')
            .attr('stroke-width', 0.8)
            .attr('opacity', 0.8)
            .style('cursor', 'pointer')
            .on('mouseover', (event, d) => {
                d3.select(event.target).attr('stroke-width', 1.5);
                this.showTooltip(event, d, 'fuente', incidenciaMap[d.ID]);
            })
            .on('mouseout', (event) => {
                d3.select(event.target).attr('stroke-width', 0.8);
                this.hideTooltip();
            })
            .on('mousemove', (event) => this.moveTooltip(event));
    }

    scaleMarkers(zoomScale) {
        // Escalar estaciones (triángulos)
        this.g.selectAll('.estacion-punto')
            .attr('transform', function() {
                const currentTransform = d3.select(this).attr('transform');
                const translateMatch = currentTransform.match(/translate\(([^,]+),([^)]+)\)/);
                if (translateMatch) {
                    const x = translateMatch[1];
                    const y = translateMatch[2];
                    return `translate(${x}, ${y}) scale(${1 / Math.sqrt(zoomScale)})`;
                }
                return currentTransform;
            });
        
        // Escalar fuentes (círculos) - radio y stroke
        this.g.selectAll('.fuente-circle')
            .attr('r', function() {
                const baseRadius = parseFloat(d3.select(this).attr('data-base-radius'));
                return baseRadius * 1 / zoomScale;
            })
    }

    calculateAverageIncidencia() {
        if (!this.stationsPermitsMatrix || this.stationsPermitsMatrix.length === 0) {
            return [];
        }

        // Agrupar por fuente y calcular promedio de incidencia
        const incidenciaPorFuente = {};
        
        let relaciones = this.stationsPermitsMatrix;
        
        // Filtrar por contaminante si hay uno seleccionado
        if (this.contaminanteSeleccionado) {
            relaciones = relaciones.filter(rel => rel.Variable === this.contaminanteSeleccionado);
        }
        
        // Filtrar por estaciones activas
        if (this.activeStations.length > 0) {
            relaciones = relaciones.filter(rel => this.activeStations.includes(rel.IDEstación));
        }

        relaciones.forEach(rel => {
            if (!incidenciaPorFuente[rel.IDEmpresa]) {
                incidenciaPorFuente[rel.IDEmpresa] = {
                    sum: 0,
                    count: 0
                };
            }
            incidenciaPorFuente[rel.IDEmpresa].sum += parseFloat(rel.Incidencia) || 0;
            incidenciaPorFuente[rel.IDEmpresa].count += 1;
        });

        // Convertir a array con promedio
        const promedios = Object.keys(incidenciaPorFuente).map(fuenteId => ({
            fuenteId: fuenteId,
            averageIncidencia: incidenciaPorFuente[fuenteId].sum / incidenciaPorFuente[fuenteId].count,
            count: incidenciaPorFuente[fuenteId].count
        }));

        return promedios;
    }

    createIncidenciaScales(promedios) {
        if (!promedios || promedios.length === 0) {
            return;
        }

        const valores = promedios.map(d => d.averageIncidencia);

        const maxRadius = 12;
        const minRadius = 3;
        const niveles = 4;
        const radios = d3.range(niveles).map(i =>
            minRadius + (i / (niveles - 1)) * (maxRadius - minRadius)
        );

        this.incidenciaRadiusScale = d3.scaleQuantize()
            .domain([0, d3.max(valores)])
            .range(radios);

    }

    showTooltip(event, data, type, incidenciaData = null) {
        let content = '';

        if (type === 'estacion') {
            content = `
                <div style="font-weight: bold; color: #4ecdc4; margin-bottom: 5px;">Estación ${data.id}</div>
                <div style="margin-top: 8px; font-weight: bold; color: #ffd93d;">Variables medidas:</div>
                <div style="margin-top: 4px;">
                    ${(this.variablesOfStation[data.id] || []).map(v => 
                        `<div style="margin-left: 10px; font-size: 11px;">• ${v}</div>`
                    ).join('') || '<div style="margin-left: 10px; font-size: 11px;">N/A</div>'}
                </div>
            `;
        } else if (type === 'fuente') {
            content = `
                <div style="font-weight: bold; color: #ff6b6b; margin-bottom: 5px;">${data.TipoFuenteEmision}</div>
                <div>Expediente: ${data.IDExpediente}</div>
                <div>Combustible: ${data.TipoCombustible}</div>
                <div>Estado: ${data.Estado}</div>
                ${incidenciaData ? `
                    <div style="margin-top: 8px; font-weight: bold; color: #ffd93d;">Incidencia Promedio: ${incidenciaData.averageIncidencia.toFixed(4)}</div>
                    <div style="font-size: 11px;">Basado en ${incidenciaData.count} relaciones</div>
                ` : ''}
                ${this.contaminanteSeleccionado ? `<div style="font-size: 11px;">Contaminante: ${this.contaminanteSeleccionado}</div>` : ''}
            `;
        }

        this.tooltip.html(content)
            .style('opacity', 1);

        this.moveTooltip(event);
    }

    hideTooltip() {
        this.tooltip.style('opacity', 0);
    }

    moveTooltip(event) {
        this.tooltip
            .style('left', (event.pageX + 15) + 'px')
            .style('top', (event.pageY - 15) + 'px');
    }

    drawLegend() {
        // Limpiar leyendas anteriores
        if (this.legendLeft) this.legendLeft.selectAll('*').remove();
        if (this.legendRight) this.legendRight.selectAll('*').remove();

        this.drawStationLegend();

        this.drawFuenteLegend();
    }

    drawStationLegend() {
        if (!this.legendLeft) return;
        
        this.legendLeft.selectAll('*').remove();
        
        // Título
        this.legendLeft.append('text')
            .attr('x', 0)
            .attr('y', 20)
            .text('Estación:')
            .style('font-size', '14px')
            .style('font-weight', 'bold')
            .style('fill', '#333');
        
        // Triángulo
        const triangleSymbol = d3.symbol().type(d3.symbolTriangle).size(100);
        
        this.legendLeft.append('path')
            .attr('d', triangleSymbol)
            .attr('transform', 'translate(80, 17)')
            .attr('fill', this.stationColorScale(this.stationsData[0]?.id || '1'))
            .attr('stroke', '#fff')
            .attr('stroke-width', 0.6);
    }

    drawFuenteLegend() {
        if (!this.legendRight) return;
        
        this.legendRight.selectAll('*').remove();
        
        // Título
        this.legendRight.append('text')
            .attr('x', 0)
            .attr('y', 20)
            .text('Incidencia de la fuente:')
            .style('font-size', '14px')
            .style('font-weight', 'bold')
            .style('fill', '#333');
        
        if (!this.incidenciaRadiusScale) return;
        
        // Obtener los tamaños únicos del range de la escala
        const radios = this.incidenciaRadiusScale.range();
        const uniqueRadios = [...new Set(radios)].sort((a, b) => a - b);
        
        // Obtener los umbrales de la escala
        const thresholds = this.incidenciaRadiusScale.thresholds();
        const domain = this.incidenciaRadiusScale.domain();
        
        // Dibujar círculos de menor a mayor en línea horizontal
        let offsetX = 180;
        uniqueRadios.forEach((radio, i) => {
            // Círculo primero
            this.legendRight.append('circle')
                .attr('cx', offsetX + radio)
                .attr('cy', 15)
                .attr('r', radio)
                .attr('fill', '#ff7f0f')
                .attr('stroke', '#fff')
                .attr('stroke-width', 0.8)
                .attr('opacity', 0.8);
            
            // Texto del rango después del círculo
            let rangoTexto = '';
            if (i === 0) {
                rangoTexto = `0-${thresholds[0]?.toFixed(2) || domain[1].toFixed(2)}`;
            } else if (i === uniqueRadios.length - 1) {
                rangoTexto = `${thresholds[i-1]?.toFixed(2) || 0}+`;
            } else {
                rangoTexto = `${thresholds[i-1]?.toFixed(2)}-${thresholds[i]?.toFixed(2)}`;
            }
            
            this.legendRight.append('text')
                .attr('x', offsetX + radio * 2 + 8)
                .attr('y', 20)
                .text(rangoTexto)
                .style('font-size', '13px')
                .style('fill', '#666');
            
            const textoWidth = rangoTexto.length * 7.5;
            offsetX += radio * 2 + textoWidth + 20;
        });
    }

    setupControls() {
        d3.select('#zoom-in').on('click', () => {
            this.svg.transition().duration(300).call(
                this.zoom.scaleBy, 1.5
            );
        });

        d3.select('#zoom-out').on('click', () => {
            this.svg.transition().duration(300).call(
                this.zoom.scaleBy, 0.75
            );
        });

        d3.select('#reset-view').on('click', () => {
            this.svg.transition().duration(300).call(
                this.zoom.transform, d3.zoomIdentity
            );
        });

        d3.select('#show-roads').on('click', () => { 
            this.showRoads = !this.showRoads;

            const vias = this.g.selectAll('.via');

            if (this.showRoads) {
                vias.style('opacity', 1);

                vias
                    .on('mouseover', this.handleRoadMouseOver.bind(this))
                    .on('mouseout', this.handleRoadMouseOut.bind(this))
                    .on('mousemove', this.handleRoadMouseMove.bind(this));
                
            } else {
                vias.style('opacity', 0);

                vias
                    .on('mouseover', null)
                    .on('mouseout', null)
                    .on('mousemove', null)
            }
        });
    }

    updateData(filteredData, activeStations = [], contaminante = '') {
        console.log('Actualizando mapa con', filteredData.length, 'fuentes,', activeStations.length, 'estaciones activas, contaminante:', contaminante);

        this.fuentesData = filteredData;
        this.activeStations = activeStations;
        this.contaminanteSeleccionado = contaminante;

        this.g.selectAll('.fuente-group').remove();
        this.g.selectAll('.estacion-punto').remove();
        this.drawFuentes();
        this.drawStations();
        this.drawLegend();
    }
}