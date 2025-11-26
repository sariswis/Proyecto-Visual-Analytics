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

        const triangleSymbol = d3.symbol().type(d3.symbolTriangle).size(36); // Tamaño base

        const estaciones = this.g.selectAll('.estacion-punto')
            .data(estacionesActivas, d => d.id);

        estaciones.enter()
            .append('path')
            .attr('class', 'estacion-punto')
            .attr('d', triangleSymbol)
            .attr('transform', d => {
                const coords = this.projection([d.longitude, d.latitude]);
                if (!coords) return 'translate(0,0)';
                return `translate(${coords[0]}, ${coords[1]})`;
            })
            .attr('fill', d => this.stationColorScale(d.id))
            .attr('stroke', '#fff')
            .attr('stroke-width', 0.8)
            .style('cursor', 'pointer')
            .on('mouseover', (event, d) => {
                d3.select(event.target).attr('stroke-width', 1.2);
                this.showTooltip(event, d, 'estacion');
            })
            .on('mouseout', (event, d) => {
                d3.select(event.target).attr('stroke-width', 0.8);
                this.hideTooltip();
            })
            .on('mousemove', (event) => this.moveTooltip(event));
    }

    drawFuentes() {
        if (!this.fuentesData || this.fuentesData.length === 0) {
            console.warn('No hay datos de fuentes para dibujar');
            return;
        }

        const fuentesConEstacionesActivas = this.fuentesData.filter(fuente => {
            const relaciones = this.getRelacionesPorFuenteYContaminante(fuente.ID, this.contaminanteSeleccionado);
            const relacionesActivas = this.filtrarRelacionesPorEstacionesActivas(relaciones);
            return relacionesActivas.length > 0 && !isNaN(fuente.Latitud) && !isNaN(fuente.Longitud);
        });

        console.log(`Mostrando ${fuentesConEstacionesActivas.length} fuentes para contaminante: ${this.contaminanteSeleccionado || 'Todos'}`);

        this.g.selectAll('.fuente-group').remove();

        const fuenteGroups = this.g.selectAll('.fuente-group')
            .data(fuentesConEstacionesActivas, d => d.ID);

        const gruposEnter = fuenteGroups.enter()
            .append('g')
            .attr('class', 'fuente-group')
            .attr('transform', d => {
                const coords = this.projection([d.Longitud, d.Latitud]);
                if (!coords) return 'translate(0,0)';
                return `translate(${coords[0]}, ${coords[1]})`;
            })
            .style('cursor', 'pointer')
            .on('mouseover', (event, d) => {
                d3.select(event.target).selectAll('path, circle').style('opacity', 0.8);
                this.showTooltip(event, d, 'fuente');
            })
            .on('mouseout', (event, d) => {
                d3.select(event.target).selectAll('path, circle').style('opacity', 1);
                this.hideTooltip();
            })
            .on('mousemove', (event) => this.moveTooltip(event));

        gruposEnter.each((d, i, nodes) => {
            const group = d3.select(nodes[i]);
            const relaciones = this.getRelacionesPorFuenteYContaminante(d.ID, this.contaminanteSeleccionado);
            const relacionesActivas = this.filtrarRelacionesPorEstacionesActivas(relaciones);

            this.dibujarFuenteDividida(group, relacionesActivas);
        });

        fuenteGroups.exit().remove();
    }

    getRelacionesPorFuenteYContaminante(fuenteId, contaminante) {
        if (!this.stationsPermitsMatrix) return [];

        let relaciones = this.stationsPermitsMatrix.filter(rel =>
            rel.IDEmpresa === fuenteId && rel.DistanciaKm <= 15
        );

        if (contaminante) {
            relaciones = relaciones.filter(rel => rel.Variable === contaminante);
        }

        return relaciones;
    }

    filtrarRelacionesPorEstacionesActivas(relaciones) {
        if (this.activeStations.length === 0) return [];
        return relaciones.filter(rel =>
            this.activeStations.includes(rel.IDEstación)
        );
    }

    dibujarFuenteDividida(group, relacionesActivas) {
        if (relacionesActivas.length === 0) return;

        const estacionesUnicas = [...new Set(relacionesActivas.map(r => r.IDEstación))];
        const numEstaciones = estacionesUnicas.length;

        // TAMAÑO CONSTANTE para todas las fuentes - 3px en zoom normal
        const baseRadius = 1.5;

        if (numEstaciones === 1) {
            const estacionId = estacionesUnicas[0];
            group.append('circle')
                .attr('r', baseRadius)
                .attr('fill', this.stationColorScale(estacionId))
                .attr('stroke', '#fff')
                .attr('stroke-width', 0.4);
        } else {
            const anguloPorcion = (2 * Math.PI) / numEstaciones;

            estacionesUnicas.forEach((estacionId, index) => {
                const startAngle = index * anguloPorcion;
                const endAngle = (index + 1) * anguloPorcion;

                const x1 = baseRadius * Math.cos(startAngle);
                const y1 = baseRadius * Math.sin(startAngle);
                const x2 = baseRadius * Math.cos(endAngle);
                const y2 = baseRadius * Math.sin(endAngle);

                const largeArc = (endAngle - startAngle) > Math.PI ? 1 : 0;

                const pathData = [
                    `M 0 0`,
                    `L ${x1} ${y1}`,
                    `A ${baseRadius} ${baseRadius} 0 ${largeArc} 1 ${x2} ${y2}`,
                    `Z`
                ].join(' ');

                group.append('path')
                    .attr('d', pathData)
                    .attr('fill', this.stationColorScale(estacionId))
                    .attr('stroke', '#fff')
                    .attr('stroke-width', 0.4);
            });
        }
    }

    showTooltip(event, data, type) {
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
            const relaciones = this.getRelacionesPorFuenteYContaminante(data.ID, this.contaminanteSeleccionado);
            const relacionesActivas = this.filtrarRelacionesPorEstacionesActivas(relaciones);
            let relacionesHTML = '';

            if (relacionesActivas.length > 0) {
                relacionesHTML = `<div style="margin-top: 8px; font-weight: bold; color: #ffd93d;">Estaciones relacionadas${this.contaminanteSeleccionado ? ` (${this.contaminanteSeleccionado})` : ''}:</div>`;
                const agrupadas = this.agruparRelacionesPorEstacion(relacionesActivas);

                agrupadas.forEach(rel => {
                    relacionesHTML += `
                        <div style="margin-top: 4px;">
                            <div>• Estación ${rel.estacionId}: ${rel.distancia.toFixed(2)} km</div>
                            ${rel.variable ? `<div style="margin-left: 10px; font-size: 11px;">Variable: ${rel.variable}</div>` : ''}
                            ${rel.incidencia ? `<div style="margin-left: 10px; font-size: 11px;">Incidencia: ${rel.incidencia}</div>` : ''}
                        </div>
                    `;
                });
            } else {
                relacionesHTML = `<div style="margin-top: 8px; font-style: italic; color: #ccc;">No hay estaciones relacionadas${this.contaminanteSeleccionado ? ` para ${this.contaminanteSeleccionado}` : ''}</div>`;
            }

            content = `
                <div style="font-weight: bold; color: #ff6b6b; margin-bottom: 5px;">${data.TipoFuenteEmision}</div>
                <div>Expediente: ${data.IDExpediente}</div>
                <div>Combustible: ${data.TipoCombustible}</div>
                <div>Estado: ${data.Estado}</div>
                ${relacionesHTML}
            `;
        }

        this.tooltip.html(content)
            .style('opacity', 1);

        this.moveTooltip(event);
    }

    agruparRelacionesPorEstacion(relaciones) {
        const agrupadas = [];
        const estacionesUnicas = [...new Set(relaciones.map(r => r.IDEstación))];

        estacionesUnicas.forEach(estacionId => {
            const relsEstacion = relaciones.filter(r => r.IDEstación === estacionId);
            const mejorRel = relsEstacion.reduce((prev, current) =>
                (prev.DistanciaKm < current.DistanciaKm) ? prev : current
            );
            agrupadas.push({
                estacionId: estacionId,
                distancia: mejorRel.DistanciaKm,
                variable: mejorRel.Variable,
                incidencia: mejorRel.Incidencia
            });
        });

        return agrupadas;
    }

    hideTooltip() {
        this.tooltip.style('opacity', 0);
    }

    moveTooltip(event) {
        this.tooltip
            .style('left', (event.pageX + 15) + 'px')
            .style('top', (event.pageY - 15) + 'px');
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
        this.drawStations();
        this.drawFuentes();
    }
}
