class Dashboard {
    constructor() {
        this.dataLoader = new DataLoader();
        this.mapManager = new MapManager('#map-svg');
        this.concentrationMapManager = new ConcentrationMapManager('#concentration-map-svg');
        this.variablesChartManager = new VariablesChartManager('#variables-chart');
        this.comparisonChartManager = new ComparisonChartManager('#comparison-chart');
        this.filterManager = new FilterManager();

        this.init();
    }

    async init() {
        try {
            console.log('Iniciando carga de datos...');

            const data = await this.dataLoader.loadAllData();

            console.log('Datos cargados:', {
                geoData: data.geoData?.features?.length,
                fuentesData: data.fuentesData?.length,
                stationsData: data.stationsData?.length,
                stationsPermitsMatrix: data.stationsPermitsMatrix?.length,
                measurementsData: data.measurementsData?.length
            });

            // Inicializar primer mapa (fuentes fijas)
            this.mapManager.init(
                data.geoData,
                data.fuentesData,
                data.stationsData,
                data.stationsPermitsMatrix
            );
            const stationColorScale = this.mapManager.getStationColorScale();

            // Inicializar segundo mapa (concentraciones)
            this.concentrationMapManager.init(
                data.geoData,
                data.stationsData,
                data.measurementsData
            );

            // Inicializar gráfica comparativa 2024 vs 2025
            this.comparisonChartManager.init(data.measurementsData);

            // Sincronizar transformaciones de zoom/pan entre mapas
            this.mapManager.setTransformSyncHandler((transform) => {
                if (transform && this.concentrationMapManager) {
                    const converted = this.convertTransformBetweenMaps(
                        transform,
                        this.mapManager,
                        this.concentrationMapManager
                    );
                    if (converted) {
                        this.concentrationMapManager.applyExternalTransform(converted);
                    }
                }
            });

            this.concentrationMapManager.setTransformSyncHandler((transform) => {
                if (transform && this.mapManager) {
                    const converted = this.convertTransformBetweenMaps(
                        transform,
                        this.concentrationMapManager,
                        this.mapManager
                    );
                    if (converted) {
                        this.mapManager.applyExternalTransform(converted);
                    }
                }
            });

            // Inicializar gráfica de variables entre estaciones
            this.variablesChartManager.init(data.measurementsData, stationColorScale);

            this.filterManager.init(this.dataLoader, data.fuentesData, (filteredData, activeStations, contaminante, municipios) => {
                console.log('Actualizando mapa con datos filtrados:', filteredData.length, 'estaciones activas:', activeStations, 'contaminante:', contaminante, 'municipios:', municipios);

                // Actualizar primer mapa
                this.mapManager.updateData(filteredData, activeStations, contaminante);

                // Actualizar segundo mapa con el contaminante seleccionado, estaciones activas y municipios
                this.concentrationMapManager.updateData(contaminante, activeStations, municipios);

                // Actualizar gráfica de variables
                this.variablesChartManager.updateData(contaminante, activeStations);

                // Actualizar comparativo anual
                this.comparisonChartManager.updateData(contaminante);
            });

        } catch (error) {
            console.error('Error inicializando dashboard:', error);
        }
    }
    convertTransformBetweenMaps(transform, sourceManager, targetManager) {
        if (!transform || !sourceManager || !targetManager) return null;

        const sourceProjection = sourceManager.getProjection();
        const targetProjection = targetManager.getProjection();
        if (!sourceProjection || !sourceProjection.invert || !targetProjection) return null;

        const sourceDims = sourceManager.getViewDimensions();
        const targetDims = targetManager.getViewDimensions();
        if (!sourceDims || !targetDims) return null;

        const clamp = (val, min, max) => Math.max(min, Math.min(max, val));
        const k = clamp(transform.k || 1, 0.5, 20);

        const sourceWidth = sourceDims.contentWidth || sourceDims.fullWidth || 1;
        const sourceHeight = sourceDims.contentHeight || sourceDims.fullHeight || 1;
        const targetWidth = targetDims.contentWidth || targetDims.fullWidth || 1;
        const targetHeight = targetDims.contentHeight || targetDims.fullHeight || 1;

        const sourceCenter = [
            (sourceDims.offsetX || 0) + sourceWidth / 2,
            (sourceDims.offsetY || 0) + sourceHeight / 2
        ];
        const projectedPoint = transform.invert(sourceCenter);
        if (!projectedPoint) return null;

        let geoCenter;
        try {
            geoCenter = sourceProjection.invert(projectedPoint);
        } catch (error) {
            console.warn('No se pudo invertir proyección de mapa fuente:', error);
            return null;
        }

        if (!geoCenter) return null;

        const targetProjected = targetProjection(geoCenter);
        if (!targetProjected) return null;

        const targetCenterX = (targetDims.offsetX || 0) + targetWidth / 2;
        const targetCenterY = (targetDims.offsetY || 0) + targetHeight / 2;

        const targetX = targetCenterX - (k * targetProjected[0]);
        const targetY = targetCenterY - (k * targetProjected[1]);

        return d3.zoomIdentity
            .scale(k)
            .translate(targetX / k, targetY / k);
    }
}

const dashboard = new Dashboard();
