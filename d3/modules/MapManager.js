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
        
        // Switch entre visualizaciones
        this.currentView = 'incidence'; // 'incidence' o 'relations'
        this.viewSwitch = null;
        
        // Radio fijo para relaciones (más pequeño)
        this.fixedRelationsRadius = 10;

        // Nueva propiedad para el filtro temporal
        this.temporaryStationFilter = null;
        this.originalActiveStations = [];
        this.isTemporaryFilterActive = false;
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
        this.setupViewSwitch();

        return this;
    }

    setupViewSwitch() {
        const switchContainer = d3.select(this.containerId).node().parentNode;
        
        // Crear contenedor para el switch en la parte inferior derecha
        this.viewSwitch = d3.select(switchContainer)
            .append('div')
            .attr('class', 'view-switch-container')
            .style('position', 'absolute')
            .style('bottom', '60px')
            .style('right', '10px')
            .style('z-index', '1000')
            .style('background', 'rgba(255,255,255,0.95)')
            .style('padding', '6px 10px')
            .style('border-radius', '15px')
            .style('border', '1px solid #ccc')
            .style('box-shadow', '0 2px 6px rgba(0,0,0,0.15)')
            .style('font-family', 'Poppins, sans-serif');

        // Título del switch
        this.viewSwitch.append('span')
            .style('font-size', '14px')
            .style('font-weight', 'bold')
            .style('margin-right', '6px')
            .style('color', '#333')
            .text('Ver:');

        // Botones de switch
        const buttonGroup = this.viewSwitch.append('div')
            .style('display', 'inline-block');

        // Botón Vista de Incidencia
        buttonGroup.append('button')
            .attr('class', 'view-btn incidence-view')
            .text('Incidencia')
            .style('padding', '3px 10px')
            .style('border', '1px solid #616970')
            .style('background', '#616970')
            .style('color', 'white')
            .style('border-radius', '12px 0 0 12px')
            .style('cursor', 'pointer')
            .style('font-size', '13px')
            .style('outline', 'none')
            .style('font-family', 'Poppins, sans-serif')
            .on('click', () => {
                this.switchView('incidence');
            });

        // Botón Vista de Relaciones
        buttonGroup.append('button')
            .attr('class', 'view-btn relations-view')
            .text('Relaciones')
            .style('padding', '3px 10px')
            .style('border', '1px solid #616970')
            .style('background', '#fff')
            .style('color', '#616970')
            .style('border-radius', '0 12px 12px 0')
            .style('cursor', 'pointer')
            .style('font-size', '13px')
            .style('outline', 'none')
            .style('margin-left', '-1px')
            .style('font-family', 'Poppins, sans-serif')
            .on('click', () => {
                this.switchView('relations');
            });
    }

    switchView(viewType) {
        if (this.currentView === viewType) return;
        
        this.currentView = viewType;
        
        // Actualizar estilos de botones
        d3.selectAll('.view-btn')
            .style('background', '#fff')
            .style('color', '#616970')
            .style('border', '1px solid #616970');

        d3.select(`.${viewType}-view`)
            .style('background', '#616970')
            .style('color', 'white')
            .style('border', '1px solid #616970');

        // Redibujar fuentes y leyenda
        this.g.selectAll('.fuente-group').remove();
        this.g.selectAll('.fuente-circle').remove();
        this.drawFuentes();
        this.drawLegend();
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

        const bannerY = height - this.bannerHeight;

        this.legendBanner = this.svg.append('g')
            .attr('class', 'legend-banner')
            .attr('transform', `translate(0, ${bannerY})`);

        this.legendBanner.append('rect')
            .attr('width', width)
            .attr('height', this.bannerHeight)
            .attr('fill', '#DEDEDE');

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
            .style('font-family', 'Poppins, sans-serif')
            .style('font-size', '12px')
            .style('pointer-events', 'none')
            .style('z-index', '1000')
            .style('max-width', '300px')
            .style('line-height', '1.4');
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
            })
            // CAMBIO: Agregar evento de clic para limpiar filtro temporal
            .on('click', (event) => {
                this.clearTemporaryFilter();
            });

        // Dibujar vías
        const vias = this.g.selectAll('.via')
            .data(this.geoDataVias.features);
            
        vias.enter()
            .append('path')
            .attr('class', 'via')
            .attr('d', this.path)
            .style('fill', '#ffffff00')
            .style('stroke', '#274C7C')
            .style('stroke-width', '0.2px')
            .style('cursor', 'pointer')
            .style('opacity', 0)
            // CAMBIO: Agregar evento de clic para limpiar filtro temporal
            .on('click', (event) => {
                this.clearTemporaryFilter();
            });

        // Dibujar estaciones
        this.drawStations();

        // Dibujar fuentes según la vista actual
        this.drawFuentes();

        // CAMBIO: Agregar rectángulo invisible para capturar clics en áreas vacías
        this.g.append('rect')
            .attr('width', this.viewWidth)
            .attr('height', this.viewHeight)
            .attr('fill', 'transparent')
            .style('pointer-events', 'all')
            .on('click', (event) => {
                this.clearTemporaryFilter();
            })
            .lower(); // Enviar al fondo
    }

    drawStations() {
        if (!this.stationsData || this.stationsData.length === 0) {
            console.warn('No hay datos de estaciones para dibujar');
            return;
        }

        // CAMBIO 1: Filtrar estaciones que tienen mediciones
        const estacionesConMediciones = this.stationsData.filter(station => {
            const variables = this.variablesOfStation[station.id];
            return variables && variables.length > 0;
        });

        const estacionesActivas = estacionesConMediciones.filter(station =>
            this.activeStations.includes(station.id) &&
            !isNaN(station.latitude) && !isNaN(station.longitude)
        );

        console.log(`Dibujando ${estacionesActivas.length} estaciones activas con mediciones`);

        this.g.selectAll('.estacion-punto').remove();

        const triangleSymbol = d3.symbol().type(d3.symbolTriangle).size(70);

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
            .on('mousemove', (event) => this.moveTooltip(event))
            // CAMBIO 2: Agregar evento de clic para filtro temporal
            .on('click', (event, d) => {
                event.stopPropagation();
                this.applyTemporaryStationFilter(d.id);
            });
    }

    applyTemporaryStationFilter(stationId) {
        if (this.isTemporaryFilterActive && this.temporaryStationFilter === stationId) {
            // Si ya está activo el filtro para esta estación, quitarlo
            this.clearTemporaryFilter();
            return;
        }

        // Guardar estado original
        this.originalActiveStations = [...this.activeStations];
        this.temporaryStationFilter = stationId;
        this.isTemporaryFilterActive = true;

        // Aplicar filtro temporal - solo esta estación
        this.activeStations = [stationId];

        console.log(`Aplicando filtro temporal para estación ${stationId}`);

        // Redibujar fuentes con el filtro temporal
        this.g.selectAll('.fuente-group').remove();
        this.g.selectAll('.fuente-circle').remove();
        this.drawFuentes();
        this.drawStations(); // Redibujar estaciones para resaltar la activa

        // Resaltar la estación seleccionada
        this.highlightSelectedStation(stationId);
    }

    // CAMBIO 4: Método para resaltar estación seleccionada
    highlightSelectedStation(stationId) {
        // Quitar resaltado anterior
        this.g.selectAll('.estacion-punto')
            .attr('stroke-width', 0.6)

        // Resaltar estación seleccionada
        this.g.selectAll('.estacion-punto')
            .filter(d => d.id === stationId)
            .attr('stroke-width', 1.2)
    }

    // CAMBIO 5: Método para limpiar filtro temporal
    clearTemporaryFilter() {
        if (!this.isTemporaryFilterActive) return;

        console.log('Limpiando filtro temporal');

        this.isTemporaryFilterActive = false;
        this.temporaryStationFilter = null;
        this.activeStations = [...this.originalActiveStations];
        this.originalActiveStations = [];

        // Quitar resaltado
        this.g.selectAll('.estacion-punto')
            .attr('stroke-width', 0.6)
            .attr('stroke', '#fff');

        // Redibujar con filtros originales
        this.g.selectAll('.fuente-group').remove();
        this.g.selectAll('.fuente-circle').remove();
        this.drawFuentes();
        this.drawStations();
    }

    drawFuentes() {
        if (!this.fuentesData || this.fuentesData.length === 0) {
            console.warn('No hay datos de fuentes para dibujar');
            return;
        }

        if (this.currentView === 'incidence') {
            this.drawFuentesIncidencia();
        } else {
            this.drawFuentesRelaciones();
        }
    }

    // MÉTODO PARA VISTA DE INCIDENCIA (círculos de tamaño variable)
    drawFuentesIncidencia() {
        const promediosIncidencia = this.calculateAverageIncidencia();
        
        if (promediosIncidencia.length === 0) {
            console.warn('No hay datos de incidencia para mostrar');
            this.g.selectAll('.fuente-circle').remove();
            return;
        }

        this.createIncidenciaScales(promediosIncidencia);

        const incidenciaMap = {};
        promediosIncidencia.forEach(p => {
            incidenciaMap[p.fuenteId] = p;
        });

        const fuentesConIncidencia = this.fuentesData.filter(fuente => 
            incidenciaMap[fuente.ID] && !isNaN(fuente.Latitud) && !isNaN(fuente.Longitud)
        );

        console.log(`Mostrando ${fuentesConIncidencia.length} fuentes con incidencia`);

        this.g.selectAll('.fuente-circle').remove();

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

    // MÉTODO PARA VISTA DE RELACIONES (gráficos de torta)
    drawFuentesRelaciones() {
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

    dibujarFuenteDividida(group, relacionesActivas) {
        if (relacionesActivas.length === 0) return;

        const estacionesUnicas = [...new Set(relacionesActivas.map(r => r.IDEstación))];
        const numEstaciones = estacionesUnicas.length;

        // Usar radio base y aplicar escala de zoom inmediatamente
        const baseRadius = this.fixedRelationsRadius;
        const currentScale = this.currentTransform.k;
        const scaledRadius = baseRadius / currentScale;

        if (numEstaciones === 1) {
            group.append('circle')
                .attr('r', scaledRadius)
                .attr('data-base-radius', baseRadius)
                .attr('fill', this.stationColorScale(estacionesUnicas[0]))
                .attr('stroke', '#fff')
                .attr('stroke-width', 0.8)
                .attr('vector-effect', 'non-scaling-stroke')
                .attr('opacity', 0.8);
        } else {
            const anguloPorcion = (2 * Math.PI) / numEstaciones;

            estacionesUnicas.forEach((estacionId, index) => {
                const startAngle = index * anguloPorcion;
                const endAngle = (index + 1) * anguloPorcion;

                const x1 = scaledRadius * Math.cos(startAngle);
                const y1 = scaledRadius * Math.sin(startAngle);
                const x2 = scaledRadius * Math.cos(endAngle);
                const y2 = scaledRadius * Math.sin(endAngle);

                const largeArc = (endAngle - startAngle) > Math.PI ? 1 : 0;

                const pathData = [
                    `M 0 0`,
                    `L ${x1} ${y1}`,
                    `A ${scaledRadius} ${scaledRadius} 0 ${largeArc} 1 ${x2} ${y2}`,
                    `Z`
                ].join(' ');

                group.append('path')
                    .attr('d', pathData)
                    .attr('fill', this.stationColorScale(estacionId))
                    .attr('stroke', '#fff')
                    .attr('stroke-width', 0.8)
                    .attr('vector-effect', 'non-scaling-stroke')
                    .attr('opacity', 0.8)
                    .attr('data-base-radius', baseRadius)
                    .attr('data-scaled-radius', scaledRadius)
                    .attr('data-num-slices', numEstaciones)
                    .attr('data-slice-index', index);
            });
        }
    }

    // MÉTODOS AUXILIARES PARA VISTA DE RELACIONES
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
        
        // Escalar fuentes de incidencia (círculos)
        this.g.selectAll('.fuente-circle')
            .attr('r', function() {
                const baseRadius = parseFloat(d3.select(this).attr('data-base-radius'));
                return baseRadius / zoomScale;
            });
        
        // CORRECCIÓN: Escalar fuentes de relaciones (gráficos de torta) - método mejorado
        this.scaleRelationsMarkers(zoomScale);
    }

    // NUEVO MÉTODO: Escalado específico para relaciones
    scaleRelationsMarkers(zoomScale) {
        if (this.currentView !== 'relations') return;

        this.g.selectAll('.fuente-group').each(function() {
            const group = d3.select(this);
            const baseRadius = parseFloat(group.select('circle, path').attr('data-base-radius')) || 6;
            const scaledRadius = baseRadius / zoomScale;
            
            // Escalar círculos individuales (fuentes con una sola estación)
            group.selectAll('circle')
                .attr('r', scaledRadius);
            
            // Escalar paths (fuentes con múltiples estaciones)
            group.selectAll('path').each(function() {
                const path = d3.select(this);
                const numSlices = parseInt(path.attr('data-num-slices')) || 1;
                const sliceIndex = parseInt(path.attr('data-slice-index')) || 0;
                
                if (numSlices > 1) {
                    const anguloPorcion = (2 * Math.PI) / numSlices;
                    const startAngle = sliceIndex * anguloPorcion;
                    const endAngle = (sliceIndex + 1) * anguloPorcion;

                    const x1 = scaledRadius * Math.cos(startAngle);
                    const y1 = scaledRadius * Math.sin(startAngle);
                    const x2 = scaledRadius * Math.cos(endAngle);
                    const y2 = scaledRadius * Math.sin(endAngle);

                    const largeArc = (endAngle - startAngle) > Math.PI ? 1 : 0;

                    const newPathData = [
                        `M 0 0`,
                        `L ${x1} ${y1}`,
                        `A ${scaledRadius} ${scaledRadius} 0 ${largeArc} 1 ${x2} ${y2}`,
                        `Z`
                    ].join(' ');

                    path.attr('d', newPathData)
                        .attr('data-scaled-radius', scaledRadius);
                }
            });
        });
    }

    // MÉTODOS PARA CÁLCULO DE INCIDENCIA
    calculateAverageIncidencia() {
        if (!this.stationsPermitsMatrix || this.stationsPermitsMatrix.length === 0) {
            return [];
        }

        const incidenciaPorFuente = {};
        
        let relaciones = this.stationsPermitsMatrix;
        
        if (this.contaminanteSeleccionado) {
            relaciones = relaciones.filter(rel => rel.Variable === this.contaminanteSeleccionado);
        }
        
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

    // TOOLTIPS
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
            if (this.currentView === 'incidence') {
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
            } else {
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

    // LEYENDA ADAPTATIVA
    drawLegend() {
        this.legendLeft.selectAll('*').remove();
        this.legendRight.selectAll('*').remove();

        this.drawStationLegend();

        if (this.currentView === 'incidence') {
            this.drawFuenteIncidenciaLegend();
        } else {
            this.drawFuenteRelacionesLegend();
        }
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
            .style('fill', '#000000')
            .style('pointer-events', 'none');
        
        // Triángulo
        const triangleSymbol = d3.symbol().type(d3.symbolTriangle).size(250);
        
        this.legendLeft.append('path')
            .attr('d', triangleSymbol)
            .attr('transform', 'translate(85, 17)')
            .attr('fill', this.stationColorScale(this.stationsData[0]?.id || '1'))
            .attr('stroke', '#fff')
            .attr('stroke-width', 0.6)
            .style('pointer-events', 'none');
    }

    drawFuenteIncidenciaLegend() {
        if (!this.legendRight) return;
        
        this.legendRight.selectAll('*').remove();
        
        // Título
        this.legendRight.append('text')
            .attr('x', 0)
            .attr('y', 20)
            .text(this.contaminanteSeleccionado == 'WDS' ? 'Influencia en la fuente:' : 'Incidencia de la fuente:')
            .style('font-size', '14px')
            .style('font-weight', 'bold')
            .style('fill', '#000000')
            .style('pointer-events', 'none');
        
        if (!this.incidenciaRadiusScale) return;
        
        const radios = this.incidenciaRadiusScale.range();
        const uniqueRadios = [...new Set(radios)].sort((a, b) => a - b);
        
        const thresholds = this.incidenciaRadiusScale.thresholds();
        const domain = this.incidenciaRadiusScale.domain();
        
        let offsetX = 180;
        uniqueRadios.forEach((radio, i) => {
            // Círculo
            this.legendRight.append('circle')
                .attr('cx', offsetX + radio)
                .attr('cy', 15)
                .attr('r', radio)
                .attr('fill', '#ff7f0f')
                .attr('stroke', '#fff')
                .attr('stroke-width', 0.8)
                .attr('opacity', 0.8)
                .style('pointer-events', 'none');
            
            // Texto del rango
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
                .style('fill', '#333')
                .style('pointer-events', 'none');
            
            const textoWidth = rangoTexto.length * 7.5;
            offsetX += radio * 2 + textoWidth + 20;
        });
    }

    drawFuenteRelacionesLegend() {
        if (!this.legendRight) return;
        
        this.legendRight.selectAll('*').remove();
        
        // Título compacto en una línea
        this.legendRight.append('text')
            .attr('x', 0)
            .attr('y', 20)
            .text('Relaciones de la fuente:')
            .style('font-size', '14px')
            .style('font-weight', 'bold')
            .style('fill', '#000000')
            .style('pointer-events', 'none');

        this.legendRight.append('text')
            .attr('x', 175)
            .attr('y', 20)
            .text('Cada porción es una estación afectada')
            .style('font-size', '14px')
            .style('fill', '#333')
            .style('pointer-events', 'none');
        
        // Ejemplo visual de torta más compacto
        const ejemploGroup = this.legendRight.append('g')
            .attr('transform', 'translate(480, 12)');
        
        // Dibujar una torta de ejemplo con 3 porciones usando el radio fijo reducido
        const baseRadius = 13;
        const anguloPorcion = (2 * Math.PI) / 3;
        
        [0, 1, 2].forEach(index => {
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

            ejemploGroup.append('path')
                .attr('d', pathData)
                .attr('fill', this.stationColorScale(String(index + 1)))
                .attr('stroke', '#fff')
                .attr('stroke-width', 0.8)
                .style('pointer-events', 'none');
        });
    }

    // CONTROLES
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
                vias.style('opacity', d => {
                    if (d.properties.Tipo === 'Troncal') return 1;
                    else if (d.properties.Tipo === 'Primaria') return 0.9;
                    else return 0.8;
                });

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

        d3.select('#show-roads').on('mouseover', (event) => { 
            if (!this.tooltip) this.setupTooltip();
            this.tooltip
                .style('opacity', 1)
                .html('<div>Mostrar/Ocultar Malla Vial</div>');

            this.moveTooltip(event)
        });

        d3.select('#show-roads').on('mouseout', (event) => { 
            if (this.tooltip) {
                this.tooltip.style('opacity', 0);
            }
        });
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

    updateData(filteredData, activeStations = [], contaminante = '') {
        console.log('Actualizando mapa con', filteredData.length, 'fuentes,', activeStations.length, 'estaciones activas, contaminante:', contaminante);

        // Si hay un filtro temporal activo, no sobrescribir las estaciones activas
        if (!this.isTemporaryFilterActive) {
            this.fuentesData = filteredData;
            this.activeStations = activeStations;
            this.contaminanteSeleccionado = contaminante;
        } else {
            this.fuentesData = filteredData;
            this.contaminanteSeleccionado = contaminante;
            // Mantener las estaciones activas del filtro temporal
        }

        this.g.selectAll('.fuente-group').remove();
        this.g.selectAll('.fuente-circle').remove();
        this.g.selectAll('.estacion-punto').remove();
        
        this.drawFuentes();
        this.drawStations();
        this.drawLegend();
    }

}