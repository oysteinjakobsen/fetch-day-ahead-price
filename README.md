# Norwegian electric power prices

Node.js script that fetches the current day-ahead price from the [ENTSO-E transarency platform API]
(https://transparency.entsoe.eu/content/static_content/Static%20content/web%20api/Guide.html)
and calculates the price in NOK based on exchange rates from [Norges Bank]
(https://www.norges-bank.no/en/Statistics/open-data/available-data/).

The market balance area (NO1-NO5) for which to fetch the price is given as argument.

The price is published to a [MQTT](https://mqtt.org) topic that can easily be consumed by [Home Assistant]
(https://www.home-assistant.io/) and probably other smart house hubs as well.

## Installation

Assuming you have [Node.js](https://nodejs.org/en/) already installed on you machine, simply clone this
project and run

```sh
npm install
```

## Configuration

The script is dependent on the following environment variables being present:

|Variable|Description|
|---|---|
|ENTSOE_TOKEN|Your ENTSO-E API token|
|MQTT_URL|The url for you MQTT server, e.g. 'mqtt://127.0.0.1'|
|MQTT_USERNAME|The MQTT server user name|
|MQTT_PASSWORD|The MQTT server password|
|MQTT_TOPIC|The topic to publish data to. If for example set to '/prices/day-ahead/current' the price will be published to a sub-topic for the given area, .e.g. '/prices/day-ahead/current/NO2'|

## Command line arguments

The script should be executed with the market balance area name as argument, e.g.:

```sh
node index.js NO2
```

## How to run

The easiest way is to create a shell script, assuming you are running on a Linux distro like Rasbian or Hassbian:

```sh
#!/bin/bash

export ENTSOE_TOKEN='<token>'
export MQTT_URL='<url>'
export MQTT_USERNAME='<username>'
export MQTT_PASSWORD='<password>'
export MQTT_TOPIC='/prices/day-ahead/current'

node index.js $1
```

Then use **crontab -e** to configure this script to be executed at every whole hour:

```
0 * * * * /full/path/fetch-day-ahead-price.sh NO2 2>&1
```

## Integration with Home Assistant

Configure a [MQTT sensor](https://www.home-assistant.io/components/sensor.mqtt/) in 
Home Assistant to import the price data:

```yaml
sensor:
  - platform: mqtt
    name: 'Strømpris'
    state_topic: /prices/day-ahead/current/NO1
    json_attributes_topic: /prices/day-ahead/current/NO1
    value_template: '{{ value_json.price_including_vat }}'
```
