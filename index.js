const https = require('https')
const xml2js = require('xml2js')
const moment = require('moment')
const mqtt = require('mqtt')

const areaMapping = {
    'NO1': '10YNO-1--------2',
    'NO2': '10YNO-2--------T',
    'NO3': '10YNO-3--------J',
    'NO4': '10YNO-4--------9',
    'NO5': '10Y1001A1001A48H'
}

const priceArea = process.argv[2]
const priceAreaCode = areaMapping[priceArea]
const entsoeToken = process.env.ENTSOE_TOKEN
const mqttUrl = process.env.MQTT_URL
const mqttUsername = process.env.MQTT_USERNAME
const mqttPassword = process.env.MQTT_PASSWORD
const mqttTopic = `${process.env.MQTT_TOPIC}/${priceArea}`

console.log(`Area: ${priceArea} (${priceAreaCode})`)

const extractPrice = response => {
    const ts = response.Publication_MarketDocument.TimeSeries[0].Period[0]
    const startDate = Date.parse(ts.timeInterval[0].start[0])
    const index = Math.floor((new Date() - startDate) / 36e5)
    const priceEurPerGWh = ts.Point[index]['price.amount'][0]

    console.log(`Hour: ${index}`)
    console.log(`Price: ${priceEurPerGWh} EUR/GWh`)

    return priceEurPerGWh
}

const extractExchangeRate = response => {
    const json = JSON.parse(response)
    const rateEurNok = json.dataSets[0].series['0:0:0:0'].observations['0'][0]

    return rateEurNok
}

const publish = message => {
    const mqttClient = mqtt.connect(mqttUrl, {
        username: mqttUsername,
        password: mqttPassword
    })

    console.log(`Topic: ${mqttTopic}`)
    
    mqttClient.publish(mqttTopic, JSON.stringify(message), {
        retain: true
    }, err => {
        mqttClient.end
    })
}

const entsoeUrl = (priceArea, token) => {
    const atStartOfDay = moment().startOf('day')
    const periodStart = atStartOfDay.format('YYYYMMDDHHmm')
    const periodEnd = atStartOfDay.hour(23).format('YYYYMMDDHHmm')

    console.log(`Period: ${periodStart} - ${periodEnd}`)

    return `https://transparency.entsoe.eu/api?documentType=A44&in_Domain=${priceArea}&out_Domain=${priceArea}&periodStart=${periodStart}&periodEnd=${periodEnd}&securityToken=${token}`
}

const round = (num, radix) => {
    const factor = Math.pow(10, radix)
    return Math.round(factor * num) / factor
}

const parser = new xml2js.Parser()

parser.addListener('end', result => {
    const priceEurPerGWh = extractPrice(result)
    const nbUrl = 'https://data.norges-bank.no/api/data/EXR/B.EUR.NOK.SP?lastNObservations=1&format=sdmx-json'

    https.get(nbUrl, result => {
        result.on('data', data => {
            const vat = 0.25
            const rateEurNok = extractExchangeRate(data)
            const price = priceEurPerGWh / 1000 * rateEurNok
            const priceIncludingVat = price * (1 + vat)
            const currentHour = moment().startOf('hour').format()

            const message = {
                hour: currentHour,
                area: priceArea,
                price: round(price, 4),
                price_including_vat: round(priceIncludingVat, 4),
                unit_of_measurement: 'NOK/kWh'
            }

            console.log(`Message: ${JSON.stringify(message)}`)

            publish(message)

            process.exit()
        })
    }).on('error', err => {
        console.error('ENTSO-E: Got error: ' + err.message)
    }).end()
})

https.get(entsoeUrl(priceAreaCode, entsoeToken), result => {
    result.on('data', data => {
        parser.parseString(data)
    })
}).on('error', err => {
    console.error('Norges Bank: Got error: ' + err.message)
}).end()
