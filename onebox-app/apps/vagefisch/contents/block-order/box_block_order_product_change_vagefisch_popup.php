<?php
class box_block_order_product_change_vagefisch_popup extends Engine_Class {

    public function process() {
        try {
            $orderproduct = OrderService::Get()->getOrderProductById(
                $this->getArgumentSecure('orderproductid', 'int')
            );

            $ajaxaction = $this->getArgumentSecure('ajaxaction', 'string');
            if ($ajaxaction) {
                $resultArray = array();
                try {
                    $session_id = $this->getArgumentSecure('sessionid', 'string');
                    if ($ajaxaction === 'start') {
                        try {
                            $product = $orderproduct->getProduct();
                            $product_name_de = $product->getField('namede', false) ?: $product->getName();
                            $articul = $product->getArticul();
                        } catch (Exception $ex) {
                            $product_name_de = $orderproduct->getProductname();
                            $articul = null;
                        }
                        $payload = array(
                            "order_id" => $orderproduct->getId(),
                            "line_id" => $orderproduct->getId(),
                            "product_name_de" => $product_name_de,
                            "sku" => $articul,
                            "ordered_qty" => (float) rtrim(rtrim($orderproduct->getProductcount(), "0"), '.'),
                            "qty_unit" => $orderproduct->getUnit() ?: ($product ? $product->getUnit() : null),
                            "scale_id" => SettingService::Get()->getSettingValue('vagefisch-api-default-scale-id'),
                            "operator_id" => $this->getUser()->getId()
                        );
                        $resultArray = VagefischService::Get()->sendRequest('/weighing/start', $payload, 'POST');
                    } elseif ($ajaxaction === 'live') {
                        $resultArray = VagefischService::Get()->sendRequest("/weighing/{$session_id}/live", [], 'GET', 3);
                    } elseif ($ajaxaction === 'confirm') {
                        $resultArray = VagefischService::Get()->sendRequest("/weighing/{$session_id}/confirm", [], 'POST');
                        if ($resultArray['status'] === 'CONFIRMED') {
                            $targetFactWeight = SettingService::Get()->getSettingValue(
                                'vagefisch-api-target-field-fact-weight'
                            );
                            if ($targetFactWeight) {
                                $orderproduct->setCustomField($targetFactWeight, $resultArray['final_weight']);
                            }
                        }
                    } elseif ($ajaxaction === 'cancel') {
                        $resultArray = VagefischService::Get()->sendRequest("/weighing/{$session_id}/cancel", [], 'POST');
                    } elseif ($ajaxaction === 'tare') {
                        $resultArray = VagefischService::Get()->sendRequest(
                            "/weighing/{$session_id}/tare", ["value" => 0], 'POST'
                        );
                    } elseif ($ajaxaction === 'zero') {
                        $resultArray = VagefischService::Get()->sendRequest("/weighing/{$session_id}/zero", [], 'POST');
                    }

                    if (isset($resultArray['status'])) {
                        $targetWeightStatus = SettingService::Get()->getSettingValue(
                            'vagefisch-api-target-field-weight-status'
                        );
                        if ($targetWeightStatus) {
                            $orderproduct->setCustomField($targetWeightStatus, $resultArray['status']);
                        }
                    }

                    $response_code = 200;
                } catch (ServiceUtils_Exception $rex) {
                    $response_code = 400;
                    if ($rex->getErrorText()) {
                        $resultArray['error'] = $this->_getErrorText($rex->getErrorText());
                    }

                    $targetWeightStatus = SettingService::Get()->getSettingValue(
                        'vagefisch-api-target-field-weight-status'
                    );
                    if ($targetWeightStatus) {
                        $orderproduct->setCustomField($targetWeightStatus, $rex->getErrorText());
                    }
                }

                header('Content-type: application/json');
                http_response_code($response_code);
                echo json_encode($resultArray);
                exit();
            }

            try {
                $product = $orderproduct->getProduct();
                $this->setValue('productname', $product->getField('namede', false) ?: $product->getName());
                $this->setValue('productarticul', $product->getArticul());
            } catch (Exception $ex) {
                $this->setValue('productname', $orderproduct->getProductname());
                $this->setValue('productarticul', false);
            }

            $targetFactWeight = SettingService::Get()->getSettingValue(
                'vagefisch-api-target-field-fact-weight'
            );
            $targetWeightStatus = SettingService::Get()->getSettingValue(
                'vagefisch-api-target-field-weight-status'
            );

            $this->setValue('productcount', rtrim(rtrim($orderproduct->getProductcount(), "0"), '.'));
            $this->setValue('productunit', $orderproduct->getUnit() ?: ($product ? $product->getUnit() : ''));
            $this->setValue('productweight', $orderproduct->getCustomField($targetFactWeight) ?: 0);
            $this->setValue('productweightstatus', $orderproduct->getCustomField($targetWeightStatus) ?: "NEW");
            $this->setValue('defaultScaleID', SettingService::Get()->getSettingValue('vagefisch-api-default-scale-id'));
            $this->setValue('id', $orderproduct->getId());
        } catch (Exception $ex) {
            header('Content-type: application/json');
            http_response_code(400);
            exit();
        }
    }

    private function _getErrorText($error_code) {
        $errorArray = array(
            'SCALE_BUSY' => TsS::Get()->getTrS('translate_vesi_zanyati_poprobuyte_pozzhe'),
            'BAD_REQUEST' => TsS::Get()->getTrS('translate_otsutstvuyut_obyazatelnie_polya'),
            'UNAUTHORIZED' => TsS::Get()->getTrS('translate_neverniy_ili_otsutstvuyushchiy_token'),
            'SCALE_NOT_FOUND' => TsS::Get()->getTrS('translate_vesi_ne_naydeni'),
            'SESSION_NOT_FOUND' => TsS::Get()->getTrS('translate_sessiya_ne_naydena_ili_istekla'),
            'ALREADY_CONFIRMED' => TsS::Get()->getTrS('translate_sessiya_uzhe_podtverzhdena'),
            'ALREADY_EXISTS' => TsS::Get()->getTrS('translate_vesi_s_takim_imenem_uzhe_sushchestvuyut'),
            'SESSION_CLOSED' => TsS::Get()->getTrS('translate_sessiya_zakrita'),
            'SESSION_CANCELLED' => TsS::Get()->getTrS('translate_sessiya_bila_otmenena'),
            'SCALE_OFFLINE' => TsS::Get()->getTrS('translate_vesi_nedostupni'),
            'SCALE_ERROR' => TsS::Get()->getTrS('translate_oshibka_svyazi_s_vesami'),
            'INTERNAL_ERROR' => TsS::Get()->getTrS('translate_vnutrennyaya_oshibka_servera'),
        );
        if (isset($errorArray[$error_code])) {
            $error_code = $errorArray[$error_code];
        }
        return $error_code;
    }
}