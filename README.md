# Tesla PV charger IOBroker script

For instructions see the script

This script is beta only.

No guarantee if it will work correctly.

I will keep improving it in the future.

One example how the script works.

From 10am it startet charging only from the pv.



The yellow graph is PV energy, the purple graph is the charging power.

![PV charge](PVCharge.png)


Adjust the constants in script according to the comments.
![Constants](constants.png)


Then enter your custom datapoints for energy and to enable the pv charging
![Variables](variables.png)

Here are some examples for this datapoints
![dp1](dp1.png)
![dp2](dp2.png)

Set ChargeStopDelayTime to a higher value if your charger turns on and off its internal relay many times during a cloudy day.
Default value is 10 seconds