update public.player_pool p set nombre = trim(concat_ws(' ', c.nombre, c.apellido1))
from public.club_players c where c.id = p.club_player_id;
update public.player_pool set nombre = 'Luzu' where id in ('zuri-15','zuri-15-raro','zuri-15-leg');
update public.club_action_types set puntos = 0 where id in ('asistencia_rosca','asistencia_vaselina','pasos','falta_en_ataque');