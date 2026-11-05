[Command]
name = "x"
command = x
time = 1

[Statedef -1]

[State -1, Punch]
type = ChangeState
value = 200
triggerall = command = "x"
trigger1 = stateno = 0
