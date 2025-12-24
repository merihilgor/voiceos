#!/usr/bin/env python3
"""
Agent Router - Flask API endpoints for VLA Agent.
VoiceOS VLA Agent: Backend API Integration

Exposes agent functionality via REST endpoints.
"""

import asyncio
import logging
from flask import Blueprint, request, jsonify

logger = logging.getLogger(__name__)

# Create blueprint
agent_bp = Blueprint('agent', __name__, url_prefix='/api/agent')


def run_async(coro):
    """Run async function in sync context."""
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    return loop.run_until_complete(coro)


@agent_bp.route('/execute', methods=['POST'])
def execute_command():
    """
    Execute a voice command through the VLA agent.
    
    Request JSON:
        {"command": "click the submit button"}
        
    Response JSON:
        {
            "success": true,
            "message": "Clicked element 5",
            "needs_confirmation": false,
            "confirmation_prompt": null,
            "attempts": 1
        }
    """
    try:
        data = request.get_json()
        if not data or 'command' not in data:
            return jsonify({
                'success': False,
                'message': 'Missing "command" in request body'
            }), 400
        
        command = data['command']
        logger.info(f"[AgentAPI] Execute: {command}")
        
        from core.agent.kernel import get_agent_kernel
        kernel = get_agent_kernel()
        
        result = run_async(kernel.process_command(command))
        
        return jsonify({
            'success': result.success,
            'message': result.message,
            'needs_confirmation': result.needs_confirmation,
            'confirmation_prompt': result.confirmation_prompt,
            'attempts': result.attempts,
            'verification_passed': result.verification_passed,
        })
        
    except Exception as e:
        logger.error(f"[AgentAPI] Error: {e}")
        return jsonify({
            'success': False,
            'message': f'Agent error: {str(e)}'
        }), 500


@agent_bp.route('/confirm', methods=['POST'])
def confirm_action():
    """
    Confirm or cancel a pending action.
    
    Request JSON:
        {"command": "delete this file", "confirmed": true}
        
    Response JSON:
        {"success": true, "message": "Action confirmed and executed."}
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({
                'success': False,
                'message': 'Missing request body'
            }), 400
        
        command = data.get('command', '')
        confirmed = data.get('confirmed', False)
        
        logger.info(f"[AgentAPI] Confirm: {command}, confirmed={confirmed}")
        
        from core.agent.kernel import get_agent_kernel
        kernel = get_agent_kernel()
        
        result = run_async(kernel.process_with_confirmation(command, confirmed))
        
        return jsonify({
            'success': result.success,
            'message': result.message,
        })
        
    except Exception as e:
        logger.error(f"[AgentAPI] Confirm error: {e}")
        return jsonify({
            'success': False,
            'message': f'Confirm error: {str(e)}'
        }), 500


@agent_bp.route('/context', methods=['GET'])
def get_context():
    """
    Get current screen context (for debugging/visualization).
    
    Response JSON:
        {
            "app_name": "Finder",
            "window_title": "Documents",
            "elements": [
                {"number": 1, "role": "button", "label": "Back"},
                ...
            ],
            "screenshot": "<base64 if requested>"
        }
    """
    try:
        include_screenshot = request.args.get('screenshot', 'false').lower() == 'true'
        
        from core.vision.screen_parser import get_screen_parser
        parser = get_screen_parser()
        
        ctx = run_async(parser.get_context(include_screenshot=include_screenshot))
        
        elements = []
        for num, el in ctx.element_map.items():
            elements.append({
                'number': num,
                'role': el.role,
                'label': el.label,
                'bounds': el.bounds,
                'enabled': el.enabled,
                'focused': el.focused,
            })
        
        response = {
            'app_name': ctx.app_name,
            'window_title': ctx.window_title,
            'elements': elements,
            'focused_element': ctx.focused_element_number,
            'text_description': ctx.text_description,
        }
        
        if include_screenshot and ctx.screenshot_b64:
            response['screenshot'] = ctx.screenshot_b64
        
        return jsonify(response)
        
    except Exception as e:
        logger.error(f"[AgentAPI] Context error: {e}")
        return jsonify({
            'error': str(e)
        }), 500


@agent_bp.route('/status', methods=['GET'])
def get_status():
    """
    Get agent status (for health check).
    
    Response JSON:
        {"status": "ready", "pending_confirmation": false}
    """
    try:
        from core.agent.safety import get_safety_guard
        safety = get_safety_guard()
        
        return jsonify({
            'status': 'ready',
            'pending_confirmation': safety.has_pending_confirmation(),
            'pending_command': safety.get_pending_command(),
        })
        
    except Exception as e:
        return jsonify({
            'status': 'error',
            'error': str(e)
        }), 500


def register_agent_routes(app):
    """Register agent blueprint with Flask app."""
    app.register_blueprint(agent_bp)
    logger.info("[AgentAPI] Routes registered at /api/agent/*")
