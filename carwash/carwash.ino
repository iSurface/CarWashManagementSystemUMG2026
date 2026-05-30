#include <SPI.h>
#include <MFRC522.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <Servo.h>

#define SS_PIN 53
#define RST_PIN 9
#define CEPILLO_IN3 26
#define CEPILLO_IN4 27
#define BOTON_PIN 6
#define SERVO_PIN 7
#define RELE_JABON 25
#define JABON_ON LOW
#define JABON_OFF HIGH
#define RELE_ENJUAGUE 28
#define ENJUAGUE_ON LOW
#define ENJUAGUE_OFF HIGH
#define IR_PIN 10
#define MOTOR_IN1 22
#define MOTOR_IN2 23
#define RELE_BOMBA 24
#define BOMBA_ON LOW
#define LED_FASE0 29
#define LED_FASE1 30
#define LED_FASE2 31
#define LED_FASE3 32
#define LED_FASE4 33
#define BOMBA_OFF HIGH
MFRC522 mfrc522(SS_PIN, RST_PIN);
LiquidCrystal_I2C lcd(0x27, 16, 2);
Servo talanquera;

String tipoLavado = "NORMAL";
bool motorTalanqueraActivo = false;
unsigned long tiempoInicioMotor = 0;
const unsigned long tiempoMotor = 1000;
const unsigned long tiempoExtraPaso = 300; // prueba 500 ms
int posicionCerrado = 90;
int posicionAbierto = 0;
bool carroDentroSensor = false;


bool ultimoEstadoBoton = HIGH;
unsigned long ultimoCambioBoton = 0;
const unsigned long debounceDelay = 200;


bool esperandoPasoCarro = false;
bool carroDetectado = false;
int lecturasValidas = 0;

void mostrarPantallaInicial() {
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Tipo: ");
  lcd.print(tipoLavado);

  lcd.setCursor(0, 1);
  lcd.print("Acerque tarjeta");
}
void moverMotorReductor() {
  digitalWrite(MOTOR_IN1, HIGH);
  digitalWrite(MOTOR_IN2, LOW);

  delay(300);

  digitalWrite(MOTOR_IN1, LOW);
  digitalWrite(MOTOR_IN2, LOW);
}
void iniciarMotorReductor() {
  digitalWrite(MOTOR_IN1, HIGH);
  digitalWrite(MOTOR_IN2, LOW);

  motorTalanqueraActivo = true;
  tiempoInicioMotor = millis();
}
void encenderJabon() {
  digitalWrite(RELE_JABON, JABON_ON);
}

void apagarJabon() {
  digitalWrite(RELE_JABON, JABON_OFF);
}
void actualizarMotorReductor() {
  if (motorTalanqueraActivo && millis() - tiempoInicioMotor >= tiempoMotor) {
    digitalWrite(MOTOR_IN1, LOW);
    digitalWrite(MOTOR_IN2, LOW);
    motorTalanqueraActivo = false;
  }
}
void cambiarTipoLavado() {
  if (tipoLavado == "NORMAL") {
    tipoLavado = "INTENSIVO";
  } else {
    tipoLavado = "NORMAL";
  }

  Serial.print("Nuevo tipo: ");
  Serial.println(tipoLavado);

  mostrarPantallaInicial();
}void verificarPasoCarro() {
  if (!esperandoPasoCarro) return;

  int lecturaIR = digitalRead(IR_PIN);

  // LOW = detecta carro
  if (lecturaIR == LOW) {
    carroDentroSensor = true;
  }

  // Cuando dejó de detectar, significa que el carro ya pasó
  if (carroDentroSensor && lecturaIR == HIGH) {

    // Ahora sí detener motor
    digitalWrite(MOTOR_IN1, LOW);
    digitalWrite(MOTOR_IN2, LOW);
    motorTalanqueraActivo = false;

    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("Carro paso");
    lcd.setCursor(0, 1);
    lcd.print("Iniciando...");

    Serial.println("CARRO_OK");

    delay(300);

    cerrarTalanquera();

    esperandoPasoCarro = false;
    carroDetectado = true;
    carroDentroSensor = false;
  }
}

void abrirTalanquera() {
  talanquera.write(posicionAbierto);
}

void cerrarTalanquera() {
  talanquera.write(posicionCerrado);
}

void encenderBomba() {
  digitalWrite(RELE_BOMBA, BOMBA_ON);
}

void apagarBomba() {
  digitalWrite(RELE_BOMBA, BOMBA_OFF);
}
void moverBanda(unsigned long tiempo) {
  digitalWrite(MOTOR_IN1, HIGH);
  digitalWrite(MOTOR_IN2, LOW);
  delay(tiempo);
  digitalWrite(MOTOR_IN1, LOW);
  digitalWrite(MOTOR_IN2, LOW);
}
void encenderEnjuague() {
  digitalWrite(RELE_ENJUAGUE, ENJUAGUE_ON);
}

void apagarEnjuague() {
  digitalWrite(RELE_ENJUAGUE, ENJUAGUE_OFF);
}
void setup() {
  Serial.begin(9600);
  pinMode(LED_FASE0, OUTPUT);
  pinMode(LED_FASE1, OUTPUT);
  pinMode(LED_FASE2, OUTPUT); 
  pinMode(LED_FASE3, OUTPUT);
  pinMode(LED_FASE4, OUTPUT);

  digitalWrite(LED_FASE0, LOW);
  digitalWrite(LED_FASE1, LOW);
  digitalWrite(LED_FASE2, LOW);
  digitalWrite(LED_FASE3, LOW);
  digitalWrite(LED_FASE4, LOW);
  SPI.begin();
  mfrc522.PCD_Init();
  pinMode(RELE_ENJUAGUE, OUTPUT);
  digitalWrite(RELE_ENJUAGUE, ENJUAGUE_OFF);

  pinMode(BOTON_PIN, INPUT_PULLUP);
  pinMode(MOTOR_IN1, OUTPUT);
  pinMode(MOTOR_IN2, OUTPUT);
  pinMode(RELE_BOMBA, OUTPUT);
  digitalWrite(RELE_BOMBA, BOMBA_OFF);
  digitalWrite(MOTOR_IN1, LOW); 
  digitalWrite(MOTOR_IN2, LOW);
  pinMode(IR_PIN, INPUT);
  pinMode(CEPILLO_IN3, OUTPUT);
  pinMode(CEPILLO_IN4, OUTPUT);

digitalWrite(CEPILLO_IN3, LOW);
digitalWrite(CEPILLO_IN4, LOW);  
 
  pinMode(RELE_JABON, OUTPUT);
  digitalWrite(RELE_JABON, JABON_OFF);
  talanquera.attach(SERVO_PIN);
  talanquera.write(posicionCerrado);

  lcd.init();
  lcd.backlight();

  mostrarPantallaInicial();

  delay(500);
  Serial.println("Sistema listo");
  Serial.println("Acerque una tarjeta...");
}

void loop() {
  leerBotonTipo();
  leerMensajesDesdeNode();
  leerTarjetaRFID();
  verificarPasoCarro();
  actualizarMotorReductor();
}
void reiniciarRFID() {
  mfrc522.PCD_Init();
  delay(50);
}
void leerBotonTipo() {
  if (esperandoPasoCarro) return;

  if (digitalRead(BOTON_PIN) == LOW) {
    cambiarTipoLavado();
    delay(500);
  }
}
void encenderCepillos() {
  digitalWrite(CEPILLO_IN3, HIGH);
  digitalWrite(CEPILLO_IN4, LOW);
}
void apagarCepillos() {
  digitalWrite(CEPILLO_IN3, LOW);
  digitalWrite(CEPILLO_IN4, LOW);
}
void apagarLedsFases() {
  digitalWrite(LED_FASE0, LOW);
  digitalWrite(LED_FASE1, LOW);
  digitalWrite(LED_FASE2, LOW);
  digitalWrite(LED_FASE3, LOW);
  digitalWrite(LED_FASE4, LOW);
}
void leerTarjetaRFID() {
  if (esperandoPasoCarro) return;

  if (!mfrc522.PICC_IsNewCardPresent()) {
    return;
  }

  if (!mfrc522.PICC_ReadCardSerial()) {
    return;
  }

  String uid = "";
  for (byte i = 0; i < mfrc522.uid.size; i++) {
    if (mfrc522.uid.uidByte[i] < 0x10) {
      uid += "0";
    }
    uid += String(mfrc522.uid.uidByte[i], HEX);
    if (i < mfrc522.uid.size - 1) {
      uid += " ";
    }
  }

  uid.toUpperCase();

  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Tarjeta leida");
  lcd.setCursor(0, 1);
  lcd.print("Verificando...");

  Serial.print("UID:");
  Serial.print(uid);
  Serial.print("|TIPO:");
  Serial.println(tipoLavado);

  mfrc522.PICC_HaltA();
  mfrc522.PCD_StopCrypto1();

  delay(500);
  reiniciarRFID();
}

void leerMensajesDesdeNode() {
  if (!Serial.available()) return;

  String mensaje = Serial.readStringUntil('\n');
  mensaje.trim();
  Serial.print("MENSAJE_RECIBIDO: ");
  Serial.println(mensaje);
  if (mensaje == "PAGO_OK") {


  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Pago aprobado");
  lcd.setCursor(0, 1);
  lcd.print("Pase el carro");

  // Activar detección antes de mover el carro
  esperandoPasoCarro = true;
  carroDetectado = false;
  carroDentroSensor = false;
  lecturasValidas = 0;
  
  abrirTalanquera();
  iniciarMotorReductor();

  
}
  else if (mensaje == "SIN_FONDOS") {
    

    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("Saldo");
    lcd.setCursor(0, 1);
    lcd.print("insuficiente");
    delay(2000);

    mostrarPantallaInicial();
  }
  else if (mensaje == "NO_REGISTRADA") {


    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("Tarjeta no");
    lcd.setCursor(0, 1);
    lcd.print("registrada");
    delay(2000);

  
    mostrarPantallaInicial();
  }
else if (mensaje == "FASE_0") {
  
  lcd.clear();
  apagarLedsFases();
  digitalWrite(LED_FASE0, HIGH); 
  lcd.setCursor(0, 0);
  lcd.print(tipoLavado);
  lcd.setCursor(0, 1);
  lcd.print("Pre-Lavado");
  encenderBomba();
  delay(3000);
  apagarBomba();

  moverBanda(450);
  apagarLedsFases();
  digitalWrite(LED_FASE1, HIGH);
  Serial.println("ENTRE_A_FASE_1");
  
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print(tipoLavado);
  lcd.setCursor(0, 1);
  lcd.print("Enjabonado");

  encenderJabon();
  delay(2000);
  apagarJabon();

  moverBanda(475);
     Serial.println("ENTRE_A_FASE_2");
  apagarLedsFases();
  digitalWrite(LED_FASE2, HIGH);
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print(tipoLavado);
  lcd.setCursor(0, 1);
  
  lcd.print("Cepillado");
  delay(5000);

  moverBanda(500);
  lcd.init();
  lcd.backlight();
   Serial.println("FIN_FASE_2");
     apagarLedsFases();
  digitalWrite(LED_FASE3, HIGH);
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print(tipoLavado);
  lcd.setCursor(0, 1);
  lcd.print("Enjuague");

  encenderEnjuague();
  delay(5000);
  apagarEnjuague();

  delay(300);
  lcd.init();
  lcd.backlight();
  apagarLedsFases();
  moverBanda(500);
    Serial.println("ENTRE_A_FASE_4");
  apagarLedsFases();
  digitalWrite(LED_FASE4, HIGH);
  lcd.clear();
  lcd.setCursor(0, 0); 
  lcd.print(tipoLavado);
  lcd.setCursor(0, 1);
  lcd.print("Secado");

  delay(5000);
}
else if (mensaje == "FASE_1") {  
  apagarLedsFases();
  digitalWrite(LED_FASE1, HIGH);
  Serial.println("ENTRE_A_FASE_1");
  
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print(tipoLavado);
  lcd.setCursor(0, 1);
  lcd.print("Enjabonado");

  encenderJabon();
  delay(2000);
  apagarJabon();

  moverBanda(475);
   Serial.println("FIN_FASE_1");
}
else if (mensaje == "FASE_2") {
  Serial.println("ENTRE_A_FASE_2");
  apagarLedsFases();
  digitalWrite(LED_FASE2, HIGH);
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print(tipoLavado);
  lcd.setCursor(0, 1);
  
  lcd.print("Cepillado");
  delay(5000);

  moverBanda(500);
  lcd.init();
  lcd.backlight();
   Serial.println("FIN_FASE_2");
}

else if (mensaje == "FASE_3") {
  Serial.println("ENTRE_A_FASE_3");
  apagarLedsFases();
  digitalWrite(LED_FASE3, HIGH);
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print(tipoLavado);
  lcd.setCursor(0, 1);
  lcd.print("Enjuague");

  encenderEnjuague();
  delay(5000);
  apagarEnjuague();

  delay(300);
  lcd.init();
  lcd.backlight();
  apagarLedsFases();
  moverBanda(500);
  Serial.println("FIN_FASE_3");
}
else if (mensaje == "FASE_4") {
  Serial.println("ENTRE_A_FASE_4");
  apagarLedsFases();
  digitalWrite(LED_FASE4, HIGH);
  lcd.clear();
  lcd.setCursor(0, 0); 
  lcd.print(tipoLavado);
  lcd.setCursor(0, 1);
  lcd.print("Secado");

  delay(5000);
  Serial.println("FIN_FASE_4");
}
else if (mensaje == "FIN") {
  apagarLedsFases();
  apagarBomba();
  apagarJabon();
  apagarEnjuague();
  apagarCepillos();

  digitalWrite(MOTOR_IN1, LOW);
  digitalWrite(MOTOR_IN2, LOW);

  esperandoPasoCarro = false;
  carroDetectado = false;
  carroDentroSensor = false;
  motorTalanqueraActivo = false;

  lcd.init();
  lcd.backlight();
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Lavado");
  lcd.setCursor(0, 1);
  lcd.print("finalizado");

  delay(2000);

  reiniciarRFID();
  mostrarPantallaInicial();

  Serial.println("LISTO_NUEVO_LAVADO");
}
}
