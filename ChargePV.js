//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////// Script to charge PV energy into your Tesla ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////// Created by MeisterQ 13.02.2023 ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////// V00.00.01 ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// Constant definitions
const PVBatteryIsPresent = true             // PV system battery is present and will always be charged first
const PVBatterySOC = 80                     // Minimum PV battery SOC to start PV autocharge
const PVIncChargingPower = 800              // Minimum power going into grid
const GridDecChargingPower = 100            // Maximum power taken from grid allowed
const maxAmps = 16                          // Maximum amps
const minAmps = 0                           // Minimum amps
const chargeIncFactor = 1                   // Increasing amps. 
const chargeDecFactor = 1                   // Decreasing amps. 
const maxAmpManual = 16                     // Max amps for non-auto mode
const pollTime = 10                         // Data refresh time in seconds
const VIN = ''             					// Your VIN
const adapterInstance = 'tesla-motors.0'    // Adapter instance


// IDs of necessary datapoints
const idChargeStart = adapterInstance + '.' + VIN + '.remote.charge_start'                      // Start charging
const idChargeStop = adapterInstance + '.' + VIN + '.remote.charge_stop'                        // Stop charging
const idChargeAmps = adapterInstance + '.' + VIN + '.remote.set_charging_amps-charging_amps'    // Set charging current
const idSOC = adapterInstance + '.' + VIN + '.charge_state.battery_level'                       // Car SOC
const idChargeLim = adapterInstance + '.' + VIN + '.charge_state.charge_limit_soc'              // Limit SOC
const idChargeState = adapterInstance + '.' + VIN + '.charge_state.charging_state'              // Charging state
const idChargePortLatch = adapterInstance + '.' + VIN + '.charge_state.charge_port_latch'       // Charge cable connected
const idChargePortOpen = adapterInstance + '.' + VIN + '.charge_state.charge_port_door_open'    // Charge port door open
const idActualCurrent = adapterInstance + '.' + VIN + '.charge_state.charger_actual_current'    // Actual current
const idPVEnergy = '0_userdata.0.Energie.Energymeter.Wirkleistung.Einspeisung'                  // Energy (W) going INTO grid (0 - xx Watt) Positive only
const idGridEnergy = '0_userdata.0.Energie.Energymeter.Wirkleistung.Bezug'                      // Energy (W) TAKEN from grid (0 - xx Watt) Positive only
const idChargeAllPV = 'javascript.0.Tesla.Charge.ChargeAllPV'                                   // Mode (true: only use energy going into grid. false: take all energy from grid)
const idPVSOC = 'modbus.1.inputRegisters.30845_SOC'                                             // SOC of PV battery (0 - 100)
const idChargeIsStarted = 'javascript.0.Tesla.Charge.isStarted'                                 // Charging is started
const idChargeIsStopped = 'javascript.0.Tesla.Charge.isStopped'                                 // Charging is stopped

// Define variables
var SOC;
var ChargeLim;
var ChargeState;
var ChargePortLatch;
var ChargePortOpen;
var PVEnergy;
var GridEnergy;
var ChargeAmps = 1;
var LastChargeAmps = 0;
var ChargeStop;
var ChargeStart;
var ChargeAllPV;
var PVSOC;
var PVBatteryCheck;
var ChargeIsStarted = false;
var ChargeIsStopped = false;
var ChargePortLatchOK = false;
var ChargePortDoorOpen = false;
var ActualCurrent = 0;

// FUNCTION: Poll data from vehicle
function getData() {
    SOC = getState(idSOC).val;
    ChargeLim = getState(idChargeLim).val;
    ChargeState = getState(idChargeState).val;
    ChargePortLatch = getState(idChargePortLatch).val;
    ChargePortOpen = getState(idChargePortOpen).val;
    PVEnergy = getState(idPVEnergy).val;
    GridEnergy = getState(idGridEnergy).val;
    ChargeAllPV = getState(idChargeAllPV).val;
    PVSOC = 60; // getState(idPVSOC).val;
    ChargeIsStarted = getState(idChargeIsStarted).val;
    ChargeIsStopped = getState(idChargeIsStopped).val;
    ActualCurrent = getState(idActualCurrent).val;
}

// Run FUNCTION once on startup
createStates();

// FUNCTION: Check charge port latch
function checkLatch() {
    if ((ChargePortLatch == 'Engaged') && (ChargePortOpen)) {
        ChargePortLatchOK = true;
    }
    else {
        ChargePortLatchOK = false;
    }
}

// FUNCTION: Check if pv system battery is present and minSOC reached
function batteryCheck() {
    if (PVBatteryIsPresent) {
        if (PVSOC > PVBatterySOC) {
            PVBatteryCheck = true;
        }
        if (PVSOC < PVBatterySOC) {
            PVBatteryCheck = false;
        }
    }
    if (!PVBatteryIsPresent) {
        PVBatteryCheck = true;
    }
    log("Batterycheck: " + PVBatteryCheck);
}

// FUNCTION: Calculate charging amps according to PV power
function calcAmps() {
    if (((ChargeAllPV) && (PVBatteryCheck) && (ChargePortLatchOK))) {
        if (PVEnergy > PVIncChargingPower) {
            ChargeStop = false;
            ChargeStart = true;
            ChargeAmps = ChargeAmps + chargeIncFactor;
        }
        if (GridEnergy > GridDecChargingPower) {
            ChargeAmps = ChargeAmps - chargeDecFactor;
        }
        if (ChargeAmps <= minAmps) {
            ChargeStart = false;
            ChargeStop = true;
            ChargeAmps = minAmps;
        }
        if (ChargeAmps > maxAmps) {
            ChargeAmps = maxAmps;
        }
    }
    else {
        ChargeAmps = maxAmpManual;
        ChargeStop = false;
        ChargeStart = true;
    }
    log("Charging amps: " + ChargeAmps);
}

// FUNCTION: Charge helper
function isCharging() {
    if ((!ChargeIsStarted) && (ChargeStart)) {
        ChargeIsStopped = false;
        setState(idChargeStart, true);
        if (ActualCurrent >= 1) {
            ChargeIsStarted = true;
        }
    }
    if ((!ChargeIsStopped) && (ChargeStop)) {
        ChargeIsStarted = false;
        setState(idChargeIsStopped, true);
        if (ActualCurrent = 0) {
            ChargeIsStopped = true;
        }
    }
}

// FUNCTION: Create datapoints in your javascript adapter
function createStates() {
    createState("Tesla.Charge.Amps");
    createState("Tesla.Charge.Stop");
    createState("Tesla.Charge.Start");
    createState("Tesla.Charge.isStarted");
    createState("Tesla.Charge.isStopped");
}

// FUNCTION: Send charging data
function sendAmpsToCar() {
    if (ChargeAmps != LastChargeAmps) {
        setState('javascript.0.Tesla.Charge.Amps', ChargeAmps);
        LastChargeAmps = ChargeAmps;
    }
}

// Control charging
on({ id: idPVEnergy, change: 'any' }, function (dp) {
    isCharging();
    calcAmps();
});


// Get data 
schedule('*/' + pollTime + ' * * * * *', function () {
    getData();
    batteryCheck();
    checkLatch();
    sendAmpsToCar();
});