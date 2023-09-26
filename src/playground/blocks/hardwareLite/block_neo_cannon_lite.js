'use strict';

(function() {
    Entry.NeoCannonLite = new (class NeoCannonLite {
        constructor() {
            this.id = '41.2';
            this.name = 'NeoCannonLite';
            this.url = 'http://www.neo3ds.com/';
            this.imageName = 'neocannonlite.png';
            this.title = {
                ko: '네오캐논',
                en: 'NeoCannon',
            };
            this.duration = 32;
            
            this.blockMenuBlocks = [
                'neocannonlite_get_vibe_value',
                'neocannonlite_set_tone',
                'neocannonlite_motor_state',
                'neocannonlite_motor_state_secs',
                'neocannonlite_motor_stop',
                'neocannonlite_shoot_reload',
                'neocannonlite_shoot_catch',
                'neocannonlite_shoot_shooting',
                'neocannonlite_angle_state',
                'neocannonlite_rgb_led_select_state',
                'neocannonlite_rgb_led_select_pwm',
                'neocannonlite_rgb_led_color_picker',
                'neocannonlite_rgb_led_pwm',
                'neocannonlite_rgb_led_off',
            ];
            this.portData = {
                baudRate: 115200,
                duration: 32,
                dataBits: 8,
                parity: 'none',
                stopBits: 1,
                bufferSize: 512,
                constantServing: true,
            };

            this.__toneTable = {
                '0': 0, C: 1, CS: 2, D: 3, DS: 4,
                E: 5, F: 6, FS: 7, G: 8, GS: 9,
                A: 10, AS: 11, B: 12,
            };
            this.__toneMap =  {
                '1': [33, 65, 131, 262, 523, 1046, 2093, 4186],
                '2': [35, 69, 139, 277, 554, 1109, 2217, 4435],
                '3': [37, 73, 147, 294, 587, 1175, 2349, 4699],
                '4': [39, 78, 156, 310, 622, 1245, 2637, 4978],
                '5': [41, 82, 165, 330, 659, 1319, 2794, 5274],
                '6': [44, 87, 175, 349, 698, 1397, 2849, 5588],
                '7': [46, 92, 185, 370, 740, 1480, 2960, 5920],
                '8': [49, 98, 196, 392, 784, 1568, 3136, 6272],
                '9': [52, 104, 208, 415, 831, 1661, 3322, 6645],
                '10': [55, 110, 220, 440, 880, 1760, 3520, 7040],
                '11': [58, 117, 233, 466, 932, 1865, 3729, 7459],
                '12': [62, 123, 247, 494, 988, 1976, 3951, 7902],
            };
            
            this.setZero();
        }

        get monitorTemplate() {
            return {
                imgPath: 'hw_lite/neocannonlite.png',
                width: 256,
                height: 256,
                listPorts: {
                    VIBE: {
                        name: '진동센서',
                        type: 'input',
                        pos: { x: 0, y: 0},
                    },
                },
                mode: 'both',
            };
        }

        getMonitorPort() {
            return { ...this.sensorData };
        }

        setZero() {
            this.txData = new Array(14).fill(0);

            this.sensorData = { VIBE: 0 };
            this.workerData = {
                OCTAVE: 0,
                NOTE: 0,
                MOTOR: 0,
                LED: 0,
                SHOOT: 0,
                D9: 0,
                D10: 0,
                ANGLE: 0,
            };

            if (Entry.hwLite) {
                Entry.hwLite.update();
            }
        }

        getDataByBuffer(buffer) {
            const datas = [];
            let lastIndex = 0;
            buffer.forEach((value, idx) => {
                if (value == 13 && buffer[idx + 1] == 10) {
                    datas.push(buffer.subarray(lastIndex, idx));
                    lastIndex = idx + 2;
                }
            });
            return datas;
        }

        // 디바이스에서 값을 읽어온다.
        handleLocalData(data) {
            const datas = this.getDataByBuffer(data);
            const sensorData = this.sensorData;

            datas.forEach((data) => {
                if (data.length <= 4 || data[0] !== 255 || data[1] !== 7) {
                    return;
                }
                const readData = data.subarray(2, data.length);
                let checkSum;

                const idx = readData[0];
                if (idx == 1) {
                    if (readData.length != 4) {
                        return;
                    }
                    const vibeState = readData[1];
                    const life = readData[2];
                    checkSum = (idx + vibeState + life) & 0xff;
                    if (checkSum != readData[3]) return;

                    sensorData.VIBE = vibeState;
                }
            });
            this.sensorData = sensorData;
        }

        //디바이스에 값을 쓴다.
        requestLocalData() {
            const workerData = this.workerData;
            const txData = this.txData;
            let checkSum = 0;
            const dataLen = txData.length;

            txData[0] = 0xff;
            txData[1] = 0x0e;
            txData[2] = 0x01;
            txData[3] = 0x03;
            txData[4] = workerData.OCTAVE;
            txData[5] = workerData.NOTE;
            txData[6] = workerData.MOTOR;
            txData[7] = workerData.LED;
            txData[8] = workerData.SHOOT;
            txData[9] = workerData.D9;
            txData[10] = workerData.D10;
            txData[11] = workerData.ANGLE;
            txData[13] = 0xa;

            for (let i = 2; i < dataLen - 2; i++) {
                checkSum += txData[i];
            }
            txData[dataLen - 2] = checkSum & 255;

            this.tx_data = txData;

            return txData;
        }

        getVibe() {
            return this.sensorData.VIBE;
        }

        setTone(script) {
            if (!script.isStart) {
                let note = script.getValue('NOTE', script);
                if (!Entry.Utils.isNumber(note)) {
                    note = this.__toneTable[note];
                }

                if (note < 0) {
                    note = 0;
                } else if (note > 12) {
                    note = 12;
                }

                let duration = script.getNumberValue('DURATION', script);

                if (duration <= 0) {
                    duration = 0;
                    this.workerData.OCTAVE = 0;
                    this.workerData.NOTE = 0;
                    return script.callReturn();
                }

                let octave = script.getNumberValue('OCTAVE', script) - 1;

                if (octave < 0) {
                    octave = 0;
                } else if (octave > 5) {
                    octave = 5;
                }

                let value = 0;
                if (note != 0) {
                    value = this.__toneMap[note][octave];
                }

                duration = duration * 1000;
                script.isStart = true;
                script.timeFlag = 1;

                this.workerData.OCTAVE = value >> 8;
                this.workerData.NOTE = value & 255;

                setTimeout(() => {
                    script.timeFlag = 0;
                }, duration + 32);
                return script;
            } else if (script.timeFlag == 1) {
                return script;
            } else {
                delete script.timeFlag;
                delete script.isStart;
                this.workerData.OCTAVE = 0;
                this.workerData.NOTE = 0;
                Entry.engine.isContinue = false;
                return script.callReturn();
            }
        }

        setMotor(script) {
            let state = script.getField('STATE');

            this.workerData.MOTOR = state;
            return script.callReturn();
        }

        setMotorSecs(script) {
            if (!script.isStart) {
                let state = script.getField('STATE');
                let duration = script.getNumberValue('DURATION', script);

                if (duration <= 0) {
                    duration = 0;
                    state = 0;
                }

                duration = duration * 1000;
                script.isStart = true;
                script.timeFlag = 1;

                this.workerData.MOTOR = state;

                setTimeout(() => {
                    script.timeFlag = 0;
                }, duration + 32);

                return script;
            } else if (script.timeFlag == 1) {
                return script;
            } else {
                delete script.timeFlag;
                delete script.isStart;
                this.workerData.MOTOR = 0;
                Entry.engine.isContinue = false;
                return script.callReturn();
            }
        }

        setMotorStop(script) {
            this.workerData.MOTOR = 0;
            return script.callReturn();
        }

        setShootReload(script) {
            if (!script.isStart) {
                let duration = script.getNumberValue('DURATION', script);

                if (duration <= 0) {
                    duration = 0;
                }

                duration = duration * 1000;
                script.isStart = true;
                script.timeFlag = 1;

                this.workerData.SHOOT = 1;
                this.workerData.D9 = 200;
                this.workerData.D10 = 0;

                setTimeout(() => {
                    script.timeFlag = 0;
                }, duration + 32);

                return script;
            } else if (script.timeFlag == 1) {
                return script;
            } else {
                delete script.timeFlag;
                delete script.isStart;
                this.workerData.SHOOT = 0;
                this.workerData.D9 = 0;
                this.workerData.D10 = 0;
                Entry.engine.isContinue = false;
                return script.callReturn();
            }
        }

        setShootCatch(script) {
            this.workerData.SHOOT = 3;
            this.workerData.D9 = 80;
            this.workerData.D10 = 0;
            return script.callReturn();
        }

        setShootShooting(script) {
            if (!script.isStart) {
                let duration = 40;
                script.isStart = true;
                script.timeFlag = 1;

                this.workerData.SHOOT = 2;
                this.workerData.D9 = 0;
                this.workerData.D10 = 200;

                setTimeout(() => {
                    script.timeFlag = 0;
                }, duration + 32);

                return script;
            } else if (script.timeFlag == 1) {
                return script;
            } else {
                this.workerData.SHOOT = 0;
                this.workerData.D9 = 0;
                this.workerData.D10 = 0;
                Entry.engine.isContinue = false;
                return script.callReturn();
            }
        }

        setAngleState(script) {
            if (!script.isStart) {
                let state = script.getNumberValue('STATE', script);
                let duration = script.getNumberValue('DURATION', script);

                if (duration <= 0) {
                    duration = 0;
                    state = 0;
                }

                duration = duration * 1000;
                script.isStart = true;
                script.timeFlag = 1;

                this.workerData.ANGLE = state;

                setTimeout(() => {
                    script.timeFlag = 0;
                }, duration + 32);

                return script;
            } else if (script.timeFlag == 1) {
                return script;
            } else {
                delete script.timeFlag;
                delete script.isStart;
                this.workerData.ANGLE = 0;
                Entry.engine.isContinue = false;
                return script.callReturn();
            }
        }

        setLed(script) {
            let color = script.getField('COLOR');
            let state = script.getField('STATE');
            let power = 0;
            
            if (state != null) {
                power = state == 1 ? 255 : 0;
            } else {
                power = script.getNumberValue('POWER', script);
            }

            if (color == 0) {
                this.workerData.LED = power;
            } else if (color == 1) {
                this.workerData.SHOOT = 4;
                this.workerData.D9 = power;
            } else if (color == 2) {
                this.workerData.SHOOT = 4;
                this.workerData.D10 = power;
            }

            return script.callReturn();
        }

        setLedPicker(script) {
            let color = script.getStringField('COLOR');

            let redPower = parseInt(color.substr(1, 2), 16);
            let greenPower = parseInt(color.substr(3, 2), 16);
            let bluePower = parseInt(color.substr(5, 2), 16);

            this.workerData.SHOOT = 4;
            this.workerData.LED = bluePower;
            this.workerData.D9 = redPower;
            this.workerData.D10 = greenPower;

            return script.callReturn();
        }

        setRGBLed(script) {
            let redPower = script.getNumberValue('RED', script);
            let greenPower = script.getNumberValue('GREEN', script);
            let bluePower = script.getNumberValue('BLUE', script);

            this.workerData.SHOOT = 4;
            this.workerData.LED = bluePower;
            this.workerData.D9 = redPower;
            this.workerData.D10 = greenPower;

            return script.callReturn();
        }

        setLedOff(script) {
            this.workerData.SHOOT = 4;
            this.workerData.LED = 0;
            this.workerData.D9 = 0;
            this.workerData.D10 = 0;

            return script.callReturn();
        }

        // Block
        setLanguage() {
            return {
                ko: {
                    template: {
                        neocannonlite_get_vibe_value: '진동 센서 감지됨',
                        neocannonlite_set_tone: '부저를 %1 %2 음으로 %3 초 연주하기 %4',
                        neocannonlite_motor_state: '%1 이동하기 %2',
                        neocannonlite_motor_state_secs: '%1 %2 초 이동하기 %3',
                        neocannonlite_motor_stop: '정지하기 %1',
                        neocannonlite_shoot_reload: '%1 초 장전하기 %2',
                        neocannonlite_shoot_catch: '장전 풀림 방지 %1',
                        neocannonlite_shoot_shooting: '발사하기 %1',
                        neocannonlite_angle_state: '각도 %1 %2 초 이동하기 %3',
                        neocannonlite_rgb_led_select_state: '%1 %2 %3',
                        neocannonlite_rgb_led_select_pwm: '%1 %2 세기로 켜기 %3',
                        neocannonlite_rgb_led_color_picker: 'RGB LED %1 %2',
                        neocannonlite_rgb_led_pwm: 'RGB LED 빨강 %1 초록 %2 파랑 %3 %4',
                        neocannonlite_rgb_led_off: 'RGB LED 끄기 %1',
                    },
                    Device: {
                        neocannonlite: '네오캐논',
                    },
                    Menus: {
                        neocannonlite: '네오캐논',
                    },
                    Helper: {
                        neocannonlite_get_vibe_value:
                            '진동 감지 여부를 가져옵니다.<br/><font color="crimson">센서값 0: `감지 못함`, 1: `감지됨`</font>',
                        neocannonlite_set_tone:
                            '부저를 통해 선택한 옥타브 음계를 통해 해당 시간만큼 소리를 냅니다.<br/><font color="crimson">(참고, 다음 블럭이 있을경우에 부저 연주시간이 끝난 후에 다음 블럭을 실행합니다.)</font>',
                        neocannonlite_motor_state: '네오캐논을 앞, 왼쪽, 오른쪽, 뒤로 이동시킬 수 있습니다.',
                        neocannonlite_motor_state_secs:
                            '네오캐논을 앞, 왼쪽, 오른쪽, 뒤로 정해진 시간(초)만큼 이동시킬 수 있습니다.',
                        neocannonlite_motor_stop: '네오캐논 이동을 정지합니다.',
                        neocannonlite_shoot_reload: '장전 모터를 정해진 시간(초)만큼 장전합니다.',
                        neocannonlite_shoot_catch:
                            '장전 모터가 풀리는 것을 방지해주기 위해 일정 세기로 잡아줍니다.',
                        neocannonlite_shoot_shooting: '장전 모터를 풀어서 발사합니다.',
                        neocannonlite_angle_state:
                            '각도 모터를 제어하여 위, 아래로 정해진 시간(초)만큼 이동합니다.',
                        neocannonlite_rgb_led_select_state:
                            'RGB LED 중 빨강, 초록, 파랑을 선택하여 ON/OFF를 제어합니다.<br/><font color="crimson">(주의, LED모드로 진행해주세요.)</font>',
                        neocannonlite_rgb_led_select_pwm:
                            'RGB LED 중 빨강, 초록, 파랑을 선택하여 세기값(0~255)을 주어 원하는 색상을 나타낼 수 있습니다.<br/><font color="crimson">(주의, LED모드로 진행해주세요.)</font>',
                        neocannonlite_rgb_led_color_picker:
                            'RGB LED를 색을 선택하여 원하는 색상을 나타낼 수 있습니다.<br/><font color="crimson">(주의, LED모드로 진행해주세요.)</font>',
                        neocannonlite_rgb_led_pwm:
                            'RGB LED에 세기값(0~255)을 주어 원하는 색상을 나타낼 수 있습니다.<br/><font color="crimson">(주의, LED모드로 진행해주세요.)</font>',
                        neocannonlite_rgb_led_off: 'RGB LED를 끌 수 있습니다.',
                    },
                },
                en: {
                    template: {
                        neocannonlite_get_vibe_value: 'Detected Vibe Sensor',
                        neocannonlite_set_tone: 'Play tone note %1 octave %2 beat %3 %4',
                        neocannonlite_motor_state: 'Move %1 %2',
                        neocannonlite_motor_state_secs: 'Move %1 %2 secs %3',
                        neocannonlite_motor_stop: 'Move Stop %1',
                        neocannonlite_shoot_reload: 'Reload %1 secs %2',
                        neocannonlite_shoot_catch: 'Anti-shoot %1',
                        neocannonlite_shoot_shooting: 'Shoot %1',
                        neocannonlite_angle_state: 'Move Angle %1 %2 secs %3',
                        neocannonlite_rgb_led_select_state: '%1 color %2 %3',
                        neocannonlite_rgb_led_select_pwm: '%1 color %2 turn on pwm %3',
                        neocannonlite_rgb_led_color_picker: 'RGB LED %1 %2',
                        neocannonlite_rgb_led_pwm: 'RGB LED R %1 G %2 B %3 %4',
                        neocannonlite_rgb_led_off: 'RGB LED OFF',
                    },
                    Device: {
                        neocannonlite: 'neocannonlite',
                    },
                    Menus: {
                        neocannonlite: 'NeoCannonLite',
                    },
                },
            };
        }

        getBlocks() {
            return {
                neocannonlite_get_vibe_value: {
                    color: EntryStatic.colorSet.block.default.HARDWARE,
                    outerLine: EntryStatic.colorSet.block.darken.HARDWARE,
                    fontColor: '#fff',
                    skeleton: 'basic_boolean_field',
                    params: [],
                    events: {},
                    def: {
                        params: [],
                        type: 'neocannonlite_get_vibe_value',
                    },
                    paramsKeyMap: {},
                    class: 'NeoCannonLiteGet',
                    isNotFor: ['NeoCannonLite'],
                    func(sprite, script) {
                        return Entry.NeoCannonLite.getVibe();
                    },
                    syntax: {
                        js: [],
                        py: [
                            {
                                syntax: 'NeoCannonLite.getVibe()',
                                blockType: 'param',
                                textParams: [],
                            },
                        ],
                    },
                },
                neocannonlite_tone_list: {
                    color: EntryStatic.colorSet.block.default.HARDWARE,
                    outerLine: EntryStatic.colorSet.block.darken.HARDWARE,
                    skeleton: 'basic_string_field',
                    statements: [],
                    template: '%1',
                    params: [
                        {
                            type: 'Dropdown',
                            options: [
                                [Lang.Blocks.silent, '0'],
                                [Lang.Blocks.do_name, 'C'],
                                [Lang.Blocks.do_sharp_name, 'CS'],
                                [Lang.Blocks.re_name, 'D'],
                                [Lang.Blocks.re_sharp_name, 'DS'],
                                [Lang.Blocks.mi_name, 'E'],
                                [Lang.Blocks.fa_name, 'F'],
                                [Lang.Blocks.fa_sharp_name, 'FS'],
                                [Lang.Blocks.sol_name, 'G'],
                                [Lang.Blocks.sol_sharp_name, 'GS'],
                                [Lang.Blocks.la_name, 'A'],
                                [Lang.Blocks.la_sharp_name, 'AS'],
                                [Lang.Blocks.si_name, 'B'],
                            ],
                            value: 'C',
                            fontSize: 11,
                            bgColor: EntryStatic.colorSet.block.darken.HARDWARE,
                            arrowColor: EntryStatic.colorSet.arrow.default.HARDWARE,
                        },
                    ],
                    events: {},
                    def: {
                        params: [null],
                    },
                    paramsKeyMap: {
                        NOTE: 0,
                    },
                    func(sprite, script) {
                        return script.getField('NOTE');
                    },
                    syntax: {
                        js: [],
                        py: [
                            {
                                syntax: '%1',
                                textParams: [
                                    {
                                        type: 'Dropdown',
                                        options: [
                                            [Lang.Blocks.silent, '0'],
                                            [Lang.Blocks.do_name, 'C'],
                                            [Lang.Blocks.do_sharp_name, 'CS'],
                                            [Lang.Blocks.re_name, 'D'],
                                            [Lang.Blocks.re_sharp_name, 'DS'],
                                            [Lang.Blocks.mi_name, 'E'],
                                            [Lang.Blocks.fa_name, 'F'],
                                            [Lang.Blocks.fa_sharp_name, 'FS'],
                                            [Lang.Blocks.sol_name, 'G'],
                                            [Lang.Blocks.sol_sharp_name, 'GS'],
                                            [Lang.Blocks.la_name, 'A'],
                                            [Lang.Blocks.la_sharp_name, 'AS'],
                                            [Lang.Blocks.si_name, 'B'],
                                        ],
                                        value: 'C',
                                        fontSize: 11,
                                        converter: Entry.block.converters.returnStringValueUpperCase,
                                        bgColor: EntryStatic.colorSet.block.darken.HARDWARE,
                                        arrowColor: EntryStatic.colorSet.arrow.default.HARDWARE,
                                    },
                                ],
                                keyOption: 'neocannonlite_tone_list',
                            },
                        ],
                    },
                },
                neocannonlite_tone_value: {
                    color: EntryStatic.colorSet.block.default.HARDWARE,
                    outerLine: EntryStatic.colorSet.block.darken.HARDWARE,
                    skeleton: 'basic_string_field',
                    statements: [],
                    template: '%1',
                    params: [
                        {
                            type: 'Block',
                            accept: 'string',
                        },
                    ],
                    events: {},
                    def: {
                        params: [
                            {
                                type: 'neocannonlite_tone_list',
                            },
                        ],
                        type: 'neocannonlite_tone_value',
                    },
                    paramsKeyMap: {
                        NOTE: 0,
                    },
                    func(sprite, script) {
                        return script.getNumberValue('NOTE');
                    },
                    syntax: {
                        js: [],
                        py: [
                            {
                                syntax: '%1',
                                keyOption: 'neocannonlite_tone_value',
                            },
                        ],
                    },
                },
                neocannonlite_octave_list: {
                    color: EntryStatic.colorSet.block.default.HARDWARE,
                    outerLine: EntryStatic.colorSet.block.darken.HARDWARE,
                    skeleton: 'basic_string_field',
                    statements: [],
                    template: '%1',
                    params: [
                        {
                            type: 'Dropdown',
                            options: [
                                ['1', '1'],
                                ['2', '2'],
                                ['3', '3'],
                                ['4', '4'],
                                ['5', '5'],
                                ['6', '6'],
                            ],
                            value: '4',
                            fontSize: 11,
                            bgColor: EntryStatic.colorSet.block.darken.HARDWARE,
                            arrowColor: EntryStatic.colorSet.arrow.default.HARDWARE,
                        },
                    ],
                    events: {},
                    def: {
                        params: [null],
                    },
                    paramsKeyMap: {
                        OCTAVE: 0,
                    },
                    func(sprite, script) {
                        return script.getField('OCTAVE');
                    },
                    syntax: {
                        js: [],
                        py: [
                            {
                                syntax: '%1',
                                keyOption: 'neocannonlite_octave_list',
                            },
                        ],
                    },
                },
                neocannonlite_set_tone: {
                    color: EntryStatic.colorSet.block.default.HARDWARE,
                    outerLine: EntryStatic.colorSet.block.darken.HARDWARE,
                    skeleton: 'basic',
                    statements: [],
                    params: [
                        {
                            type: 'Block',
                            accept: 'string',
                        },
                        {
                            type: 'Block',
                            accept: 'string',
                            defaultType: 'number',
                        },
                        {
                            type: 'Block',
                            accept: 'string',
                            defaultType: 'number',
                        },
                        {
                            type: 'Indicator',
                            img: 'block_icon/hardware_icon.svg',
                            size: 12,
                        },
                    ],
                    events: {},
                    def: {
                        params: [
                            {
                                type: 'neocannonlite_tone_list',
                            },
                            {
                                type: 'neocannonlite_octave_list',
                            },
                            {
                                type: 'text',
                                params: ['1'],
                            },
                            null,
                        ],
                        type: 'neocannonlite_set_tone',
                    },
                    paramsKeyMap: {
                        NOTE: 0,
                        OCTAVE: 1,
                        DURATION: 2,
                    },
                    class: 'NeoCannonLite',
                    isNotFor: ['NeoCannonLite'],
                    func(sprite, script) {
                        return Entry.NeoCannonLite.setTone(script);
                    },
                    syntax: {
                        js: [],
                        py: [
                            {
                                syntax: 'NeoCannonLite.tone(%1, %2, %3)',
                                textParams: [
                                    {
                                        type: 'Block',
                                        accept: 'string',
                                    },
                                    {
                                        type: 'Block',
                                        accept: 'string',
                                    },
                                    {
                                        type: 'Block',
                                        accept: 'string',
                                    },
                                ],
                            },
                        ],
                    },
                },
                neocannonlite_motor_state: {
                    color: EntryStatic.colorSet.block.default.HARDWARE,
                    outerLine: EntryStatic.colorSet.block.darken.HARDWARE,
                    skeleton: 'basic',
                    statements: [],
                    params: [
                        {
                            type: 'Dropdown',
                            options: [
                                ['앞으로', 1],
                                ['왼쪽으로', 2],
                                ['오른쪽으로', 3],
                                ['뒤로', 4],
                            ],
                            value: 1,
                            fontSize: 11,
                            bgColor: EntryStatic.colorSet.block.darken.HARDWARE,
                            arrowColor: EntryStatic.colorSet.arrow.default.HARDWARE,
                        },
                        {
                            type: 'Indicator',
                            img: 'block_icon/hardware_icon.svg',
                            size: 12,
                        },
                    ],
                    events: {},
                    def: {
                        params: [null],
                        type: 'neocannonlite_motor_state',
                    },
                    paramsKeyMap: {
                        STATE: 0,
                    },
                    class: 'NeoCannonLite',
                    isNotFor: ['NeoCannonLite'],
                    func(sprite, script) {
                        return Entry.NeoCannonLite.setMotor(script);
                    },
                    syntax: {
                        js: [],
                        py: [
                            {
                                syntax: 'NeoCannonLite.motorState(%1)',
                                textParams: [
                                    {
                                        type: 'Dropdown',
                                        options: [
                                            ['앞으로', '1'],
                                            ['왼쪽으로', '2'],
                                            ['오른쪽으로', '3'],
                                            ['뒤로', '4'],
                                        ],
                                        value: '1',
                                        fontSize: 11,
                                        arrowColor: EntryStatic.colorSet.arrow.default.HARDWARE,
                                        converter: Entry.block.converters.returnStringValueUpperCase,
                                        bgColor: EntryStatic.colorSet.block.darken.HARDWARE,
                                    },
                                ],
                            },
                        ],
                    },
                },
                neocannonlite_motor_state_secs: {
                    color: EntryStatic.colorSet.block.default.HARDWARE,
                    outerLine: EntryStatic.colorSet.block.darken.HARDWARE,
                    skeleton: 'basic',
                    statements: [],
                    params: [
                        {
                            type: 'Dropdown',
                            options: [
                                ['앞으로', 1],
                                ['왼쪽으로', 2],
                                ['오른쪽으로', 3],
                                ['뒤로', 4],
                            ],
                            value: 1,
                            fontSize: 11,
                            bgColor: EntryStatic.colorSet.block.darken.HARDWARE,
                            arrowColor: EntryStatic.colorSet.arrow.default.HARDWARE,
                        },
                        {
                            type: 'Block',
                            accept: 'string',
                            defaultType: 'number',
                        },
                        {
                            type: 'Indicator',
                            img: 'block_icon/hardware_icon.svg',
                            size: 12,
                        },
                    ],
                    events: {},
                    def: {
                        params: [
                            null,
                            {
                                type: 'text',
                                params: ['1'],
                            },
                        ],
                        type: 'neocannonlite_motor_state_secs',
                    },
                    paramsKeyMap: {
                        STATE: 0,
                        DURATION: 1,
                    },
                    class: 'NeoCannonLite',
                    isNotFor: ['NeoCannonLite'],
                    func(sprite, script) {
                        return Entry.NeoCannonLite.setMotorSecs(script);
                    },
                    syntax: {
                        js: [],
                        py: [
                            {
                                syntax: 'NeoCannonLite.motorStateSecs(%1, %2)',
                                textParams: [
                                    {
                                        type: 'Dropdown',
                                        options: [
                                            ['앞으로', '1'],
                                            ['왼쪽으로', '2'],
                                            ['오른쪽으로', '3'],
                                            ['뒤로', '4'],
                                        ],
                                        value: '1',
                                        fontSize: 11,
                                        arrowColor: EntryStatic.colorSet.arrow.default.HARDWARE,
                                        converter: Entry.block.converters.returnStringValueUpperCase,
                                        bgColor: EntryStatic.colorSet.block.darken.HARDWARE,
                                    },
                                    {
                                        type: 'Block',
                                        accept: 'string',
                                    },
                                ],
                            },
                        ],
                    },
                },
                neocannonlite_motor_stop: {
                    color: EntryStatic.colorSet.block.default.HARDWARE,
                    outerLine: EntryStatic.colorSet.block.darken.HARDWARE,
                    skeleton: 'basic',
                    statements: [],
                    params: [
                        {
                            type: 'Indicator',
                            img: 'block_icon/hardware_icon.svg',
                            size: 12,
                        },
                    ],
                    events: {},
                    def: {
                        params: [null],
                        type: 'neocannonlite_motor_stop',
                    },
                    paramsKeyMap: {},
                    class: 'NeoCannonLite',
                    isNotFor: ['NeoCannonLite'],
                    func(sprite, script) {
                        return Entry.NeoCannonLite.setMotorStop(script);
                    },
                    syntax: {
                        js: [],
                        py: [
                            {
                                syntax: 'NeoCannonLite.motorStop()',
                                textParams: [],
                            },
                        ],
                    },
                },
                neocannonlite_shoot_reload: {
                    color: EntryStatic.colorSet.block.default.HARDWARE,
                    outerLine: EntryStatic.colorSet.block.darken.HARDWARE,
                    skeleton: 'basic',
                    statements: [],
                    params: [
                        {
                            type: 'Block',
                            accept: 'string',
                            defaultType: 'number',
                        },
                        {
                            type: 'Indicator',
                            img: 'block_icon/hardware_icon.svg',
                            size: 12,
                        },
                    ],
                    events: {},
                    def: {
                        params: [
                            {
                                type: 'text',
                                params: ['1'],
                            },
                        ],
                        type: 'neocannonlite_shoot_reload',
                    },
                    paramsKeyMap: {
                        DURATION: 0,
                    },
                    class: 'NeoCannonLite',
                    isNotFor: ['NeoCannonLite'],
                    func(sprite, script) {
                        return Entry.NeoCannonLite.setShootReload(script);
                    },
                    syntax: {
                        js: [],
                        py: [
                            {
                                syntax: 'NeoCannonLite.reload(%1)',
                                textParams: [
                                    {
                                        type: 'Block',
                                        accept: 'string',
                                    },
                                ],
                            },
                        ],
                    },
                },
                neocannonlite_shoot_catch: {
                    color: EntryStatic.colorSet.block.default.HARDWARE,
                    outerLine: EntryStatic.colorSet.block.darken.HARDWARE,
                    skeleton: 'basic',
                    statements: [],
                    params: [
                        {
                            type: 'Indicator',
                            img: 'block_icon/hardware_icon.svg',
                            size: 12,
                        },
                    ],
                    events: {},
                    def: {
                        params: [null],
                        type: 'neocannonlite_shoot_catch',
                    },
                    paramsKeyMap: {},
                    class: 'NeoCannonLite',
                    isNotFor: ['NeoCannonLite'],
                    func(sprite, script) {
                        return Entry.NeoCannonLite.setShootCatch(script);
                    },
                    syntax: {
                        js: [],
                        py: [
                            {
                                syntax: 'NeoCannonLite.shootCatch()',
                                textParams: [],
                            },
                        ],
                    },
                },
                neocannonlite_shoot_shooting: {
                    color: EntryStatic.colorSet.block.default.HARDWARE,
                    outerLine: EntryStatic.colorSet.block.darken.HARDWARE,
                    skeleton: 'basic',
                    statements: [],
                    params: [
                        {
                            type: 'Indicator',
                            img: 'block_icon/hardware_icon.svg',
                            size: 12,
                        },
                    ],
                    events: {},
                    def: {
                        params: [null],
                        type: 'neocannonlite_shoot_shooting',
                    },
                    paramsKeyMap: {},
                    class: 'NeoCannonLite',
                    isNotFor: ['NeoCannonLite'],
                    func(sprite, script) {
                        return Entry.NeoCannonLite.setShootShooting(script);
                    },
                    syntax: {
                        js: [],
                        py: [
                            {
                                syntax: 'NeoCannonLite.shooting()',
                                textParams: [],
                            },
                        ],
                    },
                },
                neocannonlite_angle_state: {
                    color: EntryStatic.colorSet.block.default.HARDWARE,
                    outerLine: EntryStatic.colorSet.block.darken.HARDWARE,
                    skeleton: 'basic',
                    statements: [],
                    params: [
                        {
                            type: 'Dropdown',
                            options: [
                                ['UP', '1'],
                                ['DOWN', '2'],
                            ],
                            value: '1',
                            fontSize: 11,
                            bgColor: EntryStatic.colorSet.block.darken.HARDWARE,
                            arrowColor: EntryStatic.colorSet.arrow.default.HARDWARE,
                        },
                        {
                            type: 'Block',
                            accept: 'string',
                            defaultType: 'number',
                        },
                        {
                            type: 'Indicator',
                            img: 'block_icon/hardware_icon.svg',
                            size: 12,
                        },
                    ],
                    events: {},
                    def: {
                        params: [
                            null,
                            {
                                type: 'text',
                                params: ['0.1'],
                            },
                        ],
                        type: 'neocannonlite_angle_state',
                    },
                    paramsKeyMap: {
                        STATE: 0,
                        DURATION: 1,
                    },
                    class: 'NeoCannonLite',
                    isNotFor: ['NeoCannonLite'],
                    func(sprite, script) {
                        return Entry.NeoCannonLite.setAngleState(script);
                    },
                    syntax: {
                        js: [],
                        py: [
                            {
                                syntax: 'NeoCannonLite.angleState(%1, %2)',
                                textParams: [
                                    {
                                        type: 'Dropdown',
                                        options: [
                                            ['UP', '1'],
                                            ['DOWN', '2'],
                                        ],
                                        value: '1',
                                        fontSize: 11,
                                        arrowColor: EntryStatic.colorSet.arrow.default.HARDWARE,
                                        converter: Entry.block.converters.returnStringValueLowerCase,
                                        bgColor: EntryStatic.colorSet.block.darken.HARDWARE,
                                    },
                                    {
                                        type: 'Block',
                                        accept: 'string',
                                    },
                                ],
                            },
                        ],
                    },
                },
                neocannonlite_rgb_led_select_state: {
                    color: EntryStatic.colorSet.block.default.HARDWARE,
                    outerLine: EntryStatic.colorSet.block.darken.HARDWARE,
                    skeleton: 'basic',
                    statements: [],
                    params: [
                        {
                            type: 'Dropdown',
                            options: [
                                ['BLUE', '0'],
                                ['RED', '1'],
                                ['GREEN', '2'],
                            ],
                            value: '0',
                            fontSize: 11,
                            bgColor: EntryStatic.colorSet.block.darken.HARDWARE,
                            arrowColor: EntryStatic.colorSet.arrow.default.HARDWARE,
                        },
                        {
                            type: 'Dropdown',
                            options: [
                                ['OFF', '0'],
                                ['ON', '1'],
                            ],
                            value: '1',
                            fontSize: 11,
                            bgColor: EntryStatic.colorSet.block.darken.HARDWARE,
                            arrowColor: EntryStatic.colorSet.arrow.default.HARDWARE,
                        },
                        {
                            type: 'Indicator',
                            img: 'block_icon/hardware_icon.svg',
                            size: 12,
                        },
                    ],
                    events: {},
                    def: {
                        params: [null, null],
                        type: 'neocannonlite_rgb_led_select_state',
                    },
                    paramsKeyMap: {
                        COLOR: 0,
                        STATE: 1,
                    },
                    class: 'NeoCannonLiteRGB',
                    isNotFor: ['NeoCannonLite'],
                    func(sprite, script) {
                        return Entry.NeoCannonLite.setLed(script);
                    },
                    syntax: {
                        js: [],
                        py: [
                            {
                                syntax: 'NeoCannonLite.rgbLedSelectState(%1, %2)',
                                textParams: [
                                    {
                                        type: 'Dropdown',
                                        options: [
                                            ['BLUE', '0'],
                                            ['RED', '1'],
                                            ['GREEN', '2'],
                                        ],
                                        value: '0',
                                        fontSize: 11,
                                        arrowColor: EntryStatic.colorSet.arrow.default.HARDWARE,
                                        converter: Entry.block.converters.returnStringValueUpperCase,
                                        bgColor: EntryStatic.colorSet.block.darken.HARDWARE,
                                    },
                                    {
                                        type: 'Dropdown',
                                        options: [
                                            ['ON', '1'],
                                            ['OFF', '0'],
                                        ],
                                        value: '1',
                                        fontSize: 11,
                                        arrowColor: EntryStatic.colorSet.arrow.default.HARDWARE,
                                        converter: Entry.block.converters.returnStringValueUpperCase,
                                        bgColor: EntryStatic.colorSet.block.darken.HARDWARE,
                                    },
                                ],
                            },
                        ],
                    },
                },
                neocannonlite_rgb_led_select_pwm: {
                    color: EntryStatic.colorSet.block.default.HARDWARE,
                    outerLine: EntryStatic.colorSet.block.darken.HARDWARE,
                    skeleton: 'basic',
                    statements: [],
                    params: [
                        {
                            type: 'Dropdown',
                            options: [
                                ['BLUE', '0'],
                                ['RED', '1'],
                                ['GREEN', '2'],
                            ],
                            value: '0',
                            fontSize: 11,
                            bgColor: EntryStatic.colorSet.block.darken.HARDWARE,
                            arrowColor: EntryStatic.colorSet.arrow.default.HARDWARE,
                        },
                        {
                            type: 'Block',
                            accept: 'string',
                            defaultType: 'number',
                        },
                        {
                            type: 'Indicator',
                            img: 'block_icon/hardware_icon.svg',
                            size: 12,
                        },
                    ],
                    events: {},
                    def: {
                        params: [null, null],
                        type: 'neocannonlite_rgb_led_select_pwm',
                    },
                    paramsKeyMap: {
                        COLOR: 0,
                        POWER: 1,
                    },
                    class: 'NeoCannonLiteRGB',
                    isNotFor: ['NeoCannonLite'],
                    func(sprite, script) {
                        return Entry.NeoCannonLite.setLed(script);
                    },
                    syntax: {
                        js: [],
                        py: [
                            {
                                syntax: 'NeoCannonLite.rgbLedSelectPwm(%1, %2)',
                                textParams: [
                                    {
                                        type: 'Dropdown',
                                        options: [
                                            ['BLUE', '0'],
                                            ['RED', '1'],
                                            ['GREEN', '2'],
                                        ],
                                        value: '0',
                                        fontSize: 11,
                                        arrowColor: EntryStatic.colorSet.arrow.default.HARDWARE,
                                        converter: Entry.block.converters.returnStringValueUpperCase,
                                        bgColor: EntryStatic.colorSet.block.darken.HARDWARE,
                                    },
                                    {
                                        type: 'Block',
                                        accept: 'string',
                                    },
                                ],
                            },
                        ],
                    },
                },
                neocannonlite_rgb_led_color_picker: {
                    color: EntryStatic.colorSet.block.default.HARDWARE,
                    outerLine: EntryStatic.colorSet.block.darken.HARDWARE,
                    skeleton: 'basic',
                    statements: [],
                    params: [
                        {
                            type: 'Color',
                        },
                        {
                            type: 'Indicator',
                            img: 'block_icon/hardware_icon.svg',
                            size: 12,
                        },
                    ],
                    events: {},
                    def: {
                        params: ["#0000FF", null],
                        type: 'neocannonlite_rgb_led_color_picker',
                    },
                    paramsKeyMap: {
                        COLOR: 0,
                    },
                    class: 'NeoCannonLiteRGB',
                    isNotFor: ['NeoCannonLite'],
                    func: function(sprite, script) {
                        return Entry.NeoCannonLite.setLedPicker(script);
                    },
                    syntax: {
                        js: [],
                        py: [
                            {
                                syntax: 'NeoCannonLite.rgbLedColorPicker(%1)',
                                textParams: [
                                    {
                                        type: 'Color',
                                        converter: Entry.block.converters.returnStringValue,
                                    },
                                ],
                            },
                        ],
                    },
                },
                neocannonlite_rgb_led_pwm: {
                    color: EntryStatic.colorSet.block.default.HARDWARE,
                    outerLine: EntryStatic.colorSet.block.darken.HARDWARE,
                    skeleton: 'basic',
                    statements: [],
                    params: [
                        {
                            type: 'Block',
                            accept: 'string',
                            defaultType: 'number',
                        },
                        {
                            type: 'Block',
                            accept: 'string',
                            defaultType: 'number',
                        },
                        {
                            type: 'Block',
                            accept: 'string',
                            defaultType: 'number',
                        },
                        {
                            type: 'Indicator',
                            img: 'block_icon/hardware_icon.svg',
                            size: 12,
                        },
                    ],
                    events: {},
                    def: {
                        params: [
                            {
                                type: 'number',
                                params: ['0'],
                            },
                            {
                                type: 'number',
                                params: ['0'],
                            },
                            {
                                type: 'number',
                                params: ['0'],
                            },
                            null,
                        ],
                        type: 'neocannonlite_rgb_led_pwm',
                    },
                    paramsKeyMap: {
                        RED: 0,
                        GREEN: 1,
                        BLUE: 2,
                    },
                    class: 'NeoCannonLiteRGB',
                    isNotFor: ['NeoCannonLite'],
                    func: function(sprite, script) {
                        return Entry.NeoCannonLite.setRGBLed(script);
                    },
                    syntax: {
                        js: [],
                        py: [
                            {
                                syntax: 'NeoCannonLite.rgbLedPwm(%1, %2, %3)',
                                textParams: [
                                    {
                                        type: 'Block',
                                        accept: 'string',
                                    },
                                    {
                                        type: 'Block',
                                        accept: 'string',
                                    },
                                    {
                                        type: 'Block',
                                        accept: 'string',
                                    },
                                ],
                            },
                        ],
                    },
                },
                neocannonlite_rgb_led_off: {
                    color: EntryStatic.colorSet.block.default.HARDWARE,
                    outerLine: EntryStatic.colorSet.block.darken.HARDWARE,
                    skeleton: 'basic',
                    statements: [],
                    params: [
                        {
                            type: 'Indicator',
                            img: 'block_icon/hardware_icon.svg',
                            size: 12,
                        },
                    ],
                    events: {},
                    def: {
                        params: [null],
                        type: 'neocannonlite_rgb_led_off',
                    },
                    paramsKeyMap: {},
                    class: 'NeoCannonLiteRGB',
                    isNotFor: ['NeoCannonLite'],
                    func: function(sprite, script) {
                        return Entry.NeoCannonLite.setLedOff(script);
                    },
                    syntax: {
                        js: [],
                        py: [
                            {
                                syntax: 'NeoCannonLite.rgbLedOff()',
                                textParams: [],
                            },
                        ],
                    },
                },
            };
        }
    })();
})();

module.exports = Entry.NeoCannonLite;
