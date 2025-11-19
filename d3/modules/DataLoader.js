class DataLoader {
    constructor() {
        this.geoData = null;
        this.geoDataDepartamentos = null;
        this.geoDataVias = null;
        this.fuentesData = [];
        this.stationsData = [];
        this.stationsPermitsMatrix = [];
        this.measurementsData = [];
    }

    async loadAllData() {
        try {
            await Promise.all([
                this.loadGeoData(),
                this.loadGeoDataDepartamentos(),
                this.loadGeoDataVias(),
                this.loadFuentesData(),
                this.loadStationsData(),
                this.loadStationsPermitsMatrix(),
                this.loadMeasurementsData()
            ]);
            return {
                geoData: this.geoData,
                geoDataDepartamentos: this.geoDataDepartamentos,
                geoDataVias: this.geoDataVias,
                fuentesData: this.fuentesData,
                stationsData: this.stationsData,
                stationsPermitsMatrix: this.stationsPermitsMatrix,
                measurementsData: this.measurementsData
            };
        } catch (error) {
            console.error('Error cargando datos:', error);
            throw error; // Eliminamos el fallback a datos de ejemplo
        }
    }

    async loadGeoData() {
        this.geoData = await d3.json('../data/preparada/municipios_final.geojson');
        console.log('GeoJSON cargado:', this.geoData);
        return this.geoData;
    }

    async loadGeoDataDepartamentos() {
        this.geoDataDepartamentos = await d3.json('../data/preparada/departamentos_final.geojson');
        console.log('GeoJSON departamentos cargado:', this.geoDataDepartamentos);
        return this.geoDataDepartamentos;
    }

    async loadGeoDataVias() {
        this.geoDataVias = await d3.json('../data/preparada/vias_final.geojson');
        console.log('GeoJSON vías cargado:', this.geoDataVias);
        return this.geoDataVias;
    }

    async loadFuentesData() {
        const rawData = await d3.csv('../data/preparada/emission_permits.csv');

        this.fuentesData = rawData.map(fuente => ({
            ...fuente,
            Latitud: parseFloat(fuente.Latitud),
            Longitud: parseFloat(fuente.Longitud),
            ID: parseInt(fuente.ID)
        })).filter(fuente =>
            !isNaN(fuente.Latitud) &&
            !isNaN(fuente.Longitud) &&
            fuente.Latitud !== 0 &&
            fuente.Longitud !== 0
        );

        console.log('Datos de fuentes cargados:', this.fuentesData);
        return this.fuentesData;
    }

    async loadStationsData() {
        const rawData = await d3.csv('../data/preparada/stations.csv');

        this.stationsData = rawData.map(station => ({
            id: station.id,
            latitude: parseFloat(station.latitude),
            longitude: parseFloat(station.longitude)
        })).filter(station =>
            !isNaN(station.latitude) &&
            !isNaN(station.longitude)
        );

        console.log('Datos de estaciones cargados:', this.stationsData);
        return this.stationsData;
    }

    async loadStationsPermitsMatrix() {
        const rawData = await d3.csv('../data/preparada/stations_permits_matrix.csv');

        this.stationsPermitsMatrix = rawData.map(row => ({
            IDEstación: row.IDEstación,
            IDEmpresa: parseInt(row.IDEmpresa),
            DistanciaKm: parseFloat(row.DistanciaKm),
            Variable: row.Variable,
            Incidencia: row.Incidencia
        }));

        console.log('Matriz de relaciones cargada:', this.stationsPermitsMatrix);
        return this.stationsPermitsMatrix;
    }

    async loadMeasurementsData() {
        const rawData = await d3.csv('../data/preparada/measurements.csv');

        this.measurementsData = rawData.map(measurement => ({
            date_time: new Date(measurement.date_time),
            variable: measurement.variable,
            value: parseFloat(measurement.value),
            station: measurement.station,
            unit_measurement: measurement.unit_measurement
        })).filter(measurement =>
            !isNaN(measurement.value) &&
            measurement.value !== null &&
            measurement.date_time instanceof Date &&
            !isNaN(measurement.date_time)
        );

        console.log('Datos de mediciones cargados:', this.measurementsData);
        return this.measurementsData;
    }

    // MÉTODOS UTILES
    getUniqueValues(data, field) {
        if (!data || !Array.isArray(data)) return [];
        return [...new Set(data.map(item => item[field]))].filter(Boolean).sort();
    }

    getGeoMunicipios() {
        if (!this.geoData || !this.geoData.features) return [];
        return this.geoData.features
            .map(f => f.properties.Municipio)
            .filter(Boolean)
            .sort();
    }

    // Método útil para obtener las variables únicas de las mediciones
    getMeasurementVariables() {
        return this.getUniqueValues(this.measurementsData, 'variable');
    }

    // Método útil para obtener las estaciones únicas de las mediciones
    getMeasurementStations() {
        return this.getUniqueValues(this.measurementsData, 'station');
    }

    // Método útil para filtrar mediciones por variable y estación
    getMeasurementsByVariableAndStation(variable, station) {
        if (!this.measurementsData) return [];
        return this.measurementsData.filter(m =>
            m.variable === variable &&
            m.station === station
        );
    }

    // Método útil para obtener el rango de fechas de las mediciones
    getMeasurementsDateRange() {
        if (!this.measurementsData || this.measurementsData.length === 0) return null;

        const dates = this.measurementsData.map(m => m.date_time);
        return {
            min: new Date(Math.min(...dates)),
            max: new Date(Math.max(...dates))
        };
    }
}