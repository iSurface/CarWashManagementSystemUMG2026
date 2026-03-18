#include <SPI.h>
#include <MFRC522.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <Servo.h>

#define SS_PIN 53
#define RST_PIN 9

#define LED_G 4
#define LED_R 5
#define BOTON_PIN 6
#define SERVO_PIN 7

#define TRIG_PIN 10
#define ECHO_PIN 11

MFRC522 mfrc522(SS_PIN, RST_PIN);
LiquidCrystal_I2C lcd(0x27, 16, 2);
Servo talanquera;

String tipoLavado = "NORMAL";

int posicionCerrado = 0;
int posicionAbierto = 90;
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

void cambiarTipoLavado() {
  if (tipoLavado == "NORMAL") {
    tipoLavado = "INTENSIVO";
  } else {
    tipoLavado = "NORMAL";
  }

  Serial.print("Nuevo tipo: ");
  Serial.println(tipoLavado);

  mostrarPantallaInicial();
}

void abrirTalanquera() {
  talanquera.write(posicionAbierto);
}

void cerrarTalanquera() {
  talanquera.write(posicionCerrado);
}

float medirDistancia() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);

  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  long duracion = pulseIn(ECHO_PIN, HIGH, 30000);

  if (duracion == 0) return 999;

  float distancia = duracion * 0.0343 / 2.0;
  return distancia;
}

void verificarPasoCarro() {
  if (!esperandoPasoCarro) return;

  float distancia = medirDistancia();

  Serial.print("Distancia: ");
  Serial.println(distancia);

 
  if (distancia > 2 && distancia < 6) {
    carroDentroSensor = true;
  }


  if (carroDentroSensor && distancia >= 6) {
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("Carro paso");
    lcd.setCursor(0, 1);
    lcd.print("Iniciando...");

    Serial.println("CARRO_OK");

    delay(1000);

    cerrarTalanquera();

    esperandoPasoCarro = false;
    carroDetectado = true;
    carroDentroSensor = false;
  }

  delay(100);
}

void setup() {
  Serial.begin(9600);

  SPI.begin();
  mfrc522.PCD_Init();

  pinMode(LED_G, OUTPUT);
  pinMode(LED_R, OUTPUT);
  pinMode(BOTON_PIN, INPUT_PULLUP);

  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);

  digitalWrite(LED_G, LOW);
  digitalWrite(LED_R, LOW);

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
}

void leerBotonTipo() {
  if (esperandoPasoCarro) return;

  if (digitalRead(BOTON_PIN) == LOW) {
    cambiarTipoLavado();
    delay(500);
  }
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

  delay(1500);
}

void leerMensajesDesdeNode() {
  if (!Serial.available()) return;

  String mensaje = Serial.readStringUntil('\n');
  mensaje.trim();

  if (mensaje == "PAGO_OK") {
    digitalWrite(LED_G, HIGH);
    digitalWrite(LED_R, LOW);

    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("Pago aprobado");
    lcd.setCursor(0, 1);
    lcd.print("Pase el carro");

    abrirTalanquera();

    esperandoPasoCarro = true;
    carroDetectado = false;
    carroDentroSensor = false;
    lecturasValidas = 0;

    digitalWrite(LED_G, LOW);
  }
  else if (mensaje == "SIN_FONDOS") {
    digitalWrite(LED_G, LOW);
    digitalWrite(LED_R, HIGH);

    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("Saldo");
    lcd.setCursor(0, 1);
    lcd.print("insuficiente");
    delay(2000);

    digitalWrite(LED_R, LOW);
    mostrarPantallaInicial();
  }
  else if (mensaje == "NO_REGISTRADA") {
    digitalWrite(LED_G, LOW);
    digitalWrite(LED_R, HIGH);

    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("Tarjeta no");
    lcd.setCursor(0, 1);
    lcd.print("registrada");
    delay(2000);

    digitalWrite(LED_R, LOW);
    mostrarPantallaInicial();
  }
  else if (mensaje == "FASE_0") {
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print(tipoLavado);
    lcd.setCursor(0, 1);
    lcd.print("Pre-Lavado");
  }
  else if (mensaje == "FASE_1") {
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print(tipoLavado);
    lcd.setCursor(0, 1);
    lcd.print("Enjabonado");
  }
  else if (mensaje == "FASE_2") {
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print(tipoLavado);
    lcd.setCursor(0, 1);
    lcd.print("Cepillado");
  }
  else if (mensaje == "FASE_3") {
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print(tipoLavado);
    lcd.setCursor(0, 1);
    lcd.print("Desaguado");
  }
  else if (mensaje == "FASE_4") {
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print(tipoLavado);
    lcd.setCursor(0, 1);
    lcd.print("Secado");
  }
  else if (mensaje == "FIN") {
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("Lavado");
    lcd.setCursor(0, 1);
    lcd.print("finalizado");
    delay(2000);

    mostrarPantallaInicial();
  }
}
