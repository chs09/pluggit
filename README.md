# pluggit adapter
adapter for monitoring Pluggit ventilation unit

## Disclaimer
THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

This software is developed and tested on a Pluggit Avent AP310 ventilation unit.
Information about Pluggit ModBus(R) register can be found at http://www.pluggit.com

The software uses the nodejs ModBus(R) stack which can be found here:
  https://github.com/ericleong/node-modbus-stack

## Settings

settings.json
```json
  "mode": "periodical",
  "period": 60,
  "debug": false,
  "pluggit":
  {
    "host": "192.168.2.100",   // ip address of ventilation unit
    "port": 502,               // should be always 502
  },
  "mysql":                     // remove for no mysql database
  {
      "host": "127.0.0.1",     // ip of mysql server
      "user": "USER",          // mysql server user name
      "pass": "PASS",          // mysql server password
      "database": "DATABASE"   // database/schema name
  }
```

## main.js
main module
- general initialization
- read out pluggit values
- store values in database

## pluggit.js
modbus connector module
- read out pluggit values via modbus

### Datapoints
```json
{  
   "serial":1767847366,
   "name":"Ventilation EG",
   "version":"2.68",
   "fan1":"1758.5",
   "fan2":"2105.5",
   "t1":"16.92",
   "t2":"17.47",
   "t3":"23.56",
   "t4":"20.00",
   "t5":"88.00",
   "humidity":255,
   "bypass":0,
   "bypassState":"closed",
   "speed":3,
   "state":3,
   "stateText":"Week program",
   "alarm":0,
   "alarmState":"None",
   "filterReset":210,
   "workTime":27575
}
```

## Database
To create database use pluggit.sql

### Tables
- devices (device registry)
- state (state and alarm changes)
- pluggit (data)