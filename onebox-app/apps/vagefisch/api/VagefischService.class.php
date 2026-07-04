<?php

class VagefischService {

    public function __construct() {
        $_b = rtrim(trim(SettingService::Get()->getSettingValue('vagefisch-api-base-url')), '/'); if ($_b && substr($_b, -7) !== '/api/v1') { $_b .= '/api/v1'; } $this->_baseurl = $_b;
        $this->_token = SettingService::Get()->getSettingValue('vagefisch-api-token');
        $this->_logging = SettingService::Get()->getSettingValue('vagefisch-api-logging');
    }

    public function sendRequest($method, $data = array(), $type = 'GET', $timeout = 5) {
        if (!AppService::Get()->checkApps('vagefisch')) {
            throw new ServiceUtils_Exception('paid');
        }

        if (!$this->_baseurl) {
            throw new ServiceUtils_Exception('', 0, TsS::Get()->getTrS('translate_ne_ukazan_bazoviy_urladres_k_vagefisch_api'));
        }
        if (!$this->_token) {
            throw new ServiceUtils_Exception('', 0, TsS::Get()->getTrS('translate_ne_ukazan_token_dostupa_k_vagefisch_api'));
        }
        $headers = array("Authorization: Bearer {$this->_token}");

        $ch = curl_init();
        if ($data && $type != 'GET') {
            $headers[] = "Content-Type: application/json";
        }
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
        if ($type == 'PUT') {
            curl_setopt($ch, CURLOPT_CUSTOMREQUEST, "PUT");
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
        } elseif ($type == 'PATCH') {
            curl_setopt($ch, CURLOPT_CUSTOMREQUEST, "PATCH");
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
        } elseif ($type == 'POST') {
            curl_setopt($ch, CURLOPT_POST, 1);
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
        } else {
            curl_setopt($ch, CURLOPT_POST, false);
            curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'GET');
            if ($data) {
                $method .= '?'.http_build_query($data);
            }
        }
        curl_setopt($ch, CURLOPT_TIMEOUT, $timeout);
        curl_setopt($ch, CURLOPT_URL, $this->_baseurl.$method);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);
        $exec = curl_exec($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        $result = json_decode($exec, true);

        if ($this->_logging) {
            LogService::Get()->add(
                array(
                    'url' => $this->_baseurl.$method,
                    'headers' => $headers,
                    'request' => json_encode($data),
                    'responce' => $exec,
                    'code' => $code
                ),
                'vagefisch'
            );
            LogService::Get()->writeBuffer();
        }

        if ((isset($result['error']) && $result['error']) || !$result) {
            throw new ServiceUtils_Exception('', 0, $result['error'] ?? '');
        }

        return $result;
    }

    private $_baseurl = null;
    private $_token = null;
    private $_logging = null;

    /**
     * Получить сервис.
     * Сервис можно подменивать через метод ::Set()
     *
     * @return VagefischService
     */
    public static function Get() {
        if (!self::$_Instance) {
            $classname = self::$_Classname;
            if ($classname) {
                self::$_Instance = new $classname();
            } else {
                self::$_Instance = new self();
            }
        }
        return self::$_Instance;
    }

    /**
     * Задать класс сервиса.
     * override-метод.
     *
     * @param string $classname
     */
    public static function Set($classname) {
        self::$_Classname = $classname;
        self::$_Instance = null;
    }

    private static $_Instance = null;

    private static $_Classname = false;
}