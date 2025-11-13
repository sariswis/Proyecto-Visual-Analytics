# Cálculo de incidencia de las empresas en la calidad del aire

## Cálculo de la probabilidad de emisión de una variable por parte de una empresa

La probabilidad de que una empresa arroje una variable medida es:

$$Probabilidad_{Emisión} = Factor_{Infracción} * \frac{Probabilidad_{Combustible} * Ponderacion_{Combustible} + Probabilidad_{Fuente} * Ponderacion_{Fuente}}{9}$$

Donde: 

- $Factor_{Infracción}$ aumenta la incidencia de las empresas con infracciones, de la siguiente manera:
    - Si no tiene infracción, $Factor_{Infracción} = 1$
    - Si la infracción es "Por emisiones atmosféricas sin cumplir con los requisitos de ley", $Factor_{Infracción} = 1.2$
    - Si la infracción es "Por emisiones atmosféricas sin permiso o no cumplimiento con los términos del permiso", $Factor_{Infracción} = 1.3$
    - Si la infracción es "Emitir por encima de los parámetros establecidos en la norma", $Factor_{Infracción} = 1.4$

- $Probabilidad_{Combustible}$ y $Ponderacion_{Combustible}$ provienen del cruce de la variable y el tipo de combustible en la matriz Variable - Tipo de combustible
- $Probabilidad_{Fuente}$ y $Ponderacion_{Fuente}$ provienen del cruce de la variable y el tipo de fuente en la matriz Variable - Tipo de fuente de emisión

## Cálculo de la incidencia 

La incidencia de una empresa en una estación depende de la $Probabilidad_{Emisión}$, la distancia empresa - estación en kilómetros ($distancia$) y el rango promedio de dispersión de la variable en cuestión $RangoPromedio_{Km}$

Para ello, se multiplica la probabilidad obtenida anteriormente por un factor determinado por la función gaussiana. Esta es una versión simplificada del Modelo Gaussiano de Dispersión de Contaminantes. Como resultado, se obtiene un porcentaje.

$$Incidencia =  Probabilidad_{Emisión} * e^{-\frac{1}{2}  (\frac{distancia}{RangoPromedio_{Km}})^2}$$