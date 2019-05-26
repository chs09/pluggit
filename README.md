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
  "enabled": true,
  "mode": "periodical",
  "period": 60,
  "firstId": 102000,
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

## pluggit.js
main module
- general initialization
- read out pluggit values
- store values in database

## Database
To create database use pluggit.sql

### Tables
- devices (device registry)
- state (state and alarm changes)
- pluggit (data)