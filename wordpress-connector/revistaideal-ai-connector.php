<?php
/**
 * Plugin Name: Revista Ideal AI Connector
 * Description: Expoe com seguranca os metadados SEO do tema Revista Ideal na REST API para a aplicacao Netlify/Supabase.
 * Version: 1.0.0
 * Author: Revista Ideal
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

function ri_ai_connector_register_meta() {
    $auth = static function() {
        return current_user_can( 'edit_posts' );
    };

    register_post_meta( 'post', '_ri_seo_title', array(
        'type' => 'string',
        'single' => true,
        'show_in_rest' => true,
        'sanitize_callback' => 'sanitize_text_field',
        'auth_callback' => $auth,
    ) );

    register_post_meta( 'post', '_ri_seo_description', array(
        'type' => 'string',
        'single' => true,
        'show_in_rest' => true,
        'sanitize_callback' => 'sanitize_textarea_field',
        'auth_callback' => $auth,
    ) );

    register_post_meta( 'post', '_ri_sponsored', array(
        'type' => 'boolean',
        'single' => true,
        'show_in_rest' => true,
        'sanitize_callback' => 'rest_sanitize_boolean',
        'auth_callback' => $auth,
    ) );
}
add_action( 'init', 'ri_ai_connector_register_meta' );

function ri_ai_connector_routes() {
    register_rest_route( 'ri-ai/v1', '/ping', array(
        'methods' => 'GET',
        'permission_callback' => static function() {
            return current_user_can( 'edit_posts' );
        },
        'callback' => static function() {
            $user = wp_get_current_user();
            return rest_ensure_response( array(
                'ok' => true,
                'site' => get_bloginfo( 'name' ),
                'url' => home_url( '/' ),
                'user' => array(
                    'id' => $user->ID,
                    'name' => $user->display_name,
                ),
                'connector_version' => '1.0.0',
            ) );
        },
    ) );
}
add_action( 'rest_api_init', 'ri_ai_connector_routes' );
