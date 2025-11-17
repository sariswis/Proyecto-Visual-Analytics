class Dashboard {
    constructor() {
        this.dataLoader = new DataLoader();
        this.mapManager = new MapManager('#map-svg');
        this.concentrationMapManager = new ConcentrationMapManager('#concentration-map-svg');
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

            // Inicializar segundo mapa (concentraciones)
            this.concentrationMapManager.init(
                data.geoData,
                data.stationsData,
                data.measurementsData
            );

            this.filterManager.init(this.dataLoader, data.fuentesData, (filteredData, activeStations, contaminante, municipios) => {
                console.log('Actualizando mapa con datos filtrados:', filteredData.length, 'estaciones activas:', activeStations, 'contaminante:', contaminante, 'municipios:', municipios);

                // Actualizar primer mapa
                this.mapManager.updateData(filteredData, activeStations, contaminante);

                // Actualizar segundo mapa con el contaminante seleccionado, estaciones activas y municipios
                this.concentrationMapManager.updateData(contaminante, activeStations, municipios);
            });

        } catch (error) {
            console.error('Error inicializando dashboard:', error);
        }
    }
}

const dashboard = new Dashboard();